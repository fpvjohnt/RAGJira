import pandas as pd
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import os

# ────────────────────────────────────────────────
# Step 1 — Load cleaned Jira data
# ────────────────────────────────────────────────
cleaned_file = "data/jira_cleaned_ready.csv"

if not os.path.exists(cleaned_file):
    raise FileNotFoundError(f"❌ Could not find {cleaned_file}. Run step5_clean_descriptions.py first.")

df = pd.read_csv(cleaned_file)
print(f"✅ Loaded {len(df)} cleaned Jira records for indexing.")

# ────────────────────────────────────────────────
# Step 2 — Load embedding model
# ────────────────────────────────────────────────
print("\n🔄 Loading embedding model (this may take a few seconds)...")
model = SentenceTransformer("all-MiniLM-L6-v2")

# ────────────────────────────────────────────────
# Step 3 — Create embeddings
# ────────────────────────────────────────────────
print("\n🧠 Generating embeddings from cleaned ticket text...")
embeddings = model.encode(df["Cleaned_Text"].tolist(), show_progress_bar=True)

# ────────────────────────────────────────────────
# Step 4 — Build FAISS index
# ────────────────────────────────────────────────
print("\n⚙️ Building FAISS index...")
dimension = embeddings.shape[1]
index = faiss.IndexFlatL2(dimension)
index.add(np.array(embeddings, dtype=np.float32))

# ────────────────────────────────────────────────
# Step 5 — Save index and reference data
# ────────────────────────────────────────────────
os.makedirs("data", exist_ok=True)
faiss.write_index(index, "data/jira_index.faiss")

# Save a lightweight reference CSV (only what’s needed for retrieval)
df[["Ticket Key", "Store Number", "Status", "Priority", "Business Priority", "Cleaned_Text"]].to_csv(
    "data/jira_reference.csv", index=False
)

print("\n✅ FAISS index built and saved successfully!")
print(f"📦 Total vectors stored: {index.ntotal}")
print("🗂️ Saved reference file → data/jira_reference.csv")
