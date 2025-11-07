from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import pandas as pd
import numpy as np
import faiss
import time
import re
from datetime import datetime
import os

# Allow VS Code terminal to initialize before prompting
time.sleep(1)

# ────────────────────────────────────────────────
# Step 1 — Load FAISS index and reference data
# ────────────────────────────────────────────────
print("📂 Loading Jira index and data...")
index = faiss.read_index("data/jira_index.faiss")
df = pd.read_csv("data/jira_reference.csv")
print(f"✅ Loaded {len(df)} Jira records.\n")

# ────────────────────────────────────────────────
# Step 2 — Load models
# ────────────────────────────────────────────────
print("🔄 Loading models (this may take ~15 seconds)...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")
generator = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
print("✅ Models ready!\n")

# ────────────────────────────────────────────────
# Step 3 — Get user query
# ────────────────────────────────────────────────
query = input("Ask your Jira analytical question: ")

# ────────────────────────────────────────────────
# Step 4 — Retrieve relevant Jira tickets
# ────────────────────────────────────────────────
query_vector = embedder.encode([query])
k = 10  # Retrieve more records for better insight
D, I = index.search(np.array(query_vector, dtype=np.float32), k)

# ────────────────────────────────────────────────
# Step 5 — Clean and build usable context
# ────────────────────────────────────────────────
context_parts = []
for idx in I[0]:
    # Use the cleaned column instead of raw "text"
    text = str(df.iloc[idx]["Cleaned_Text"]) if "Cleaned_Text" in df.columns else str(df.iloc[idx]["text"])

    # Clean Markdown bullets, stars, and extra whitespace
    text = re.sub(r"[*•#_\-]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()

    # Skip if mostly numbers or too short
    if re.fullmatch(r"[\d\W_]+", text.strip()):
        continue
    if len(re.findall(r"[A-Za-z]", text)) < 10:
        continue

    context_parts.append(text)

context = " ".join(context_parts)

# Fallback if context is too short or numeric-heavy
if len(context.strip()) < 100:
    context = (
        "Incident descriptions are brief or contain limited text. "
        "Assume these involve hardware faults, network issues, or vendor delays "
        "causing camera outages in retail stores."
    )

# Debug preview
print("\n🧩 Retrieved context preview:\n")
print(context[:800])
print("\n───────────────────────────────────────────────\n")

# ────────────────────────────────────────────────
# Step 6 — Compose structured analytical prompt
# ────────────────────────────────────────────────
prompt = (
    f"You are a senior data analyst summarizing camera-related incidents from Jira maintenance logs. "
    f"Below are extracted ticket details:\n{context}\n\n"
    f"Write a structured executive summary with the following sections:\n\n"
    f"**Findings:** Summarize key recurring problems observed across the tickets.\n"
    f"**Root Causes:** Identify likely underlying causes (e.g., hardware, network, vendor coordination).\n"
    f"**Recommendations:** Provide 2–3 concise, actionable recommendations to prevent future incidents.\n\n"
    f"Write in professional, clear English suitable for presentation in a Tableau dashboard or weekly IT summary."
)

# ────────────────────────────────────────────────
# Step 7 — Generate analytical insight
# ────────────────────────────────────────────────
inputs = tokenizer(prompt, return_tensors="pt", truncation=True)
outputs = generator.generate(**inputs, max_length=700, num_beams=4)
answer = tokenizer.decode(outputs[0], skip_special_tokens=True)

# ────────────────────────────────────────────────
# Step 8 — Display result
# ────────────────────────────────────────────────
print("\n📊 Query:", query)
print("\n🧠 Insight:\n", answer)

# ────────────────────────────────────────────────
# Step 9 — Optional: Save query & insight to CSV
# ────────────────────────────────────────────────
report_path = "data/generated_insights.csv"

# Create CSV file if it doesn’t exist
if not os.path.exists(report_path):
    pd.DataFrame(columns=["timestamp", "query", "insight"]).to_csv(report_path, index=False)

# Append the new record
new_record = pd.DataFrame(
    [[datetime.now().strftime("%Y-%m-%d %H:%M:%S"), query, answer]],
    columns=["timestamp", "query", "insight"]
)
new_record.to_csv(report_path, mode="a", header=False, index=False)

print(f"\n🗂️ Insight saved to: {report_path}")
