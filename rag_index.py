from sentence_transformers import SentenceTransformer
import faiss
import pandas as pd
import numpy as np

# Load your dataset
df = pd.read_csv("data/sample_docs.csv")

# Load embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Encode text
embeddings = model.encode(df["text"].tolist(), show_progress_bar=True)

# Convert to FAISS index
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(np.array(embeddings, dtype=np.float32))

# Save index and mapping
faiss.write_index(index, "data/rag_index.faiss")
df.to_csv("data/rag_docs.csv", index=False)

print("✅ Vector index built and saved successfully!")
