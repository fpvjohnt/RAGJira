from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import faiss
import pandas as pd
import numpy as np
import time

# Small delay so VS Code terminal handles input() cleanly
time.sleep(1)

# Step 1: Load FAISS index and dataset
index = faiss.read_index("data/rag_index.faiss")
df = pd.read_csv("data/rag_docs.csv")

# Step 2: Load embedding and generation models
embedder = SentenceTransformer('all-MiniLM-L6-v2')
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")
generator = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")

# Step 3: Ask your analytical question
query = input("\nAsk your analytical question: ")

# Step 4: Encode and search for top matches
if index.ntotal == 0:
    raise ValueError("❌ The FAISS index is empty. Run rag_index.py to build it before querying.")

query_vector = embedder.encode([query])
k = min(3, index.ntotal)  # avoid requesting more vectors than exist
D, I = index.search(np.array(query_vector, dtype=np.float32), k)

# Step 5: Safely build the context from retrieved text
context_parts = []
available_columns = [col for col in ("Rewritten_Text", "Cleaned_Text", "text") if col in df.columns]

for idx in I[0]:
    if idx == -1:
        continue

    row = df.iloc[idx]
    snippet = next((str(row[col]) for col in available_columns if pd.notna(row[col]) and str(row[col]).strip()), "")

    if snippet:
        context_parts.append(snippet)

context = " ".join(context_parts)

if not context.strip():
    context = (
        "No detailed ticket narratives were retrieved. Summarize typical monitoring "
        "camera incidents, focusing on operational impact, common causes, and actions taken."
    )

# Step 6: Build the analytical prompt
prompt = (
    f"Based on the following incident data: {context}\n\n"
    f"Explain the key factors that impact MTTR and summarize any patterns or root causes. "
    f"Answer in an analytical tone."
)

# Step 7: Generate analytical insight
inputs = tokenizer(prompt, return_tensors="pt")
outputs = generator.generate(**inputs, max_length=400)
answer = tokenizer.decode(outputs[0], skip_special_tokens=True)

# Step 8: Display results
print("\n📊 Query:", query)
print("🧠 Insight:", answer)
