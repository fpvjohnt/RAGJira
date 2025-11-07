from sentence_transformers import SentenceTransformer
import faiss
import pandas as pd
import numpy as np

# Load index and documents
index = faiss.read_index("data/rag_index.faiss")
df = pd.read_csv("data/rag_docs.csv")
model = SentenceTransformer('all-MiniLM-L6-v2')

# User query
query = "How can I speed up incident resolution in ServiceNow?"
query_vector = model.encode([query])

# Search
k = 2  # top 2 matches
D, I = index.search(np.array(query_vector, dtype=np.float32), k)

print("\n🔎 Query:", query)
for idx in I[0]:
    print(f"Match: {df.iloc[idx]['text']}")
