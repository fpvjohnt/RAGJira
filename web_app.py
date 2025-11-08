"""Web-based UI for the RAG Jira chatbot.

A Flask web application that provides a modern, interactive interface
for querying Jira tickets using natural language.

Usage::

    python web_app.py

Then open your browser to http://localhost:5000
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

app = Flask(__name__)

# Global variables for models (loaded once at startup)
encoder: Optional[SentenceTransformer] = None
tokenizer: Optional[AutoTokenizer] = None
model: Optional[AutoModelForSeq2SeqLM] = None
index: Optional[faiss.Index] = None
reference_df: Optional[pd.DataFrame] = None

# Configuration
CONFIG = {
    "index_path": "data/jira_index.faiss",
    "reference_path": "data/jira_reference.csv",
    "original_csv": "apt_tickets_complete_cleaned.csv",
    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
    "llm_model": "google/flan-t5-small",
    "top_k": 5,
}

# Global variable for original data with all fields
original_df: Optional[pd.DataFrame] = None


def load_models():
    """Load all models and data at startup."""
    global encoder, tokenizer, model, index, reference_df, original_df

    print("Loading models and data...")

    # Load FAISS index
    index_path = Path(CONFIG["index_path"])
    if not index_path.exists():
        print(f"Error: Index file not found at {index_path}")
        print("Please run: python step3_build_index.py")
        return False

    index = faiss.read_index(str(index_path))
    print(f"[OK] Loaded FAISS index: {index_path}")

    # Load reference data
    reference_path = Path(CONFIG["reference_path"])
    if not reference_path.exists():
        print(f"Error: Reference file not found at {reference_path}")
        return False

    reference_df = pd.read_csv(reference_path)
    print(f"[OK] Loaded reference data: {reference_path} ({len(reference_df)} tickets)")

    # Load original CSV with all fields
    original_csv_path = Path(CONFIG["original_csv"])
    if original_csv_path.exists():
        original_df = pd.read_csv(original_csv_path)
        print(f"[OK] Loaded original data with all fields: {len(original_df)} tickets")
    else:
        print(f"[WARNING] Original CSV not found, using reference data only")

    # Load embedding model
    encoder = SentenceTransformer(CONFIG["embedding_model"])
    print(f"[OK] Loaded embedding model: {CONFIG['embedding_model']}")

    # Load language model
    tokenizer = AutoTokenizer.from_pretrained(CONFIG["llm_model"])
    model = AutoModelForSeq2SeqLM.from_pretrained(CONFIG["llm_model"])
    print(f"[OK] Loaded language model: {CONFIG['llm_model']}")

    print("\n[SUCCESS] All models loaded successfully!\n")
    return True


def retrieve_similar_tickets(query: str, top_k: int = 5) -> list[dict]:
    """Retrieve the most similar tickets for a given query."""
    if encoder is None or index is None or reference_df is None:
        return []

    query_vec = encoder.encode([query])
    distances, indices = index.search(query_vec.astype(np.float32), top_k)

    results = []
    for idx, distance in zip(indices[0], distances[0]):
        ref_row = reference_df.iloc[idx]
        ticket_key = str(ref_row.get("Ticket Key", ref_row.get("Key", f"Ticket-{idx}")))

        # Get full ticket details from original CSV
        ticket_data = {
            "ticket_id": ticket_key,
            "summary": str(ref_row.get("Summary", "N/A")),
            "status": str(ref_row.get("Status", "N/A")),
            "text": str(ref_row.get("Cleaned_Text", ""))[:800],
            "similarity": float(1 / (1 + distance)),
        }

        # Add all additional fields from original CSV if available
        if original_df is not None:
            orig_ticket = original_df[original_df["Ticket Key"] == ticket_key]
            if not orig_ticket.empty:
                orig_row = orig_ticket.iloc[0]

                # Format store number without decimals
                store_num = orig_row.get("Store Number")
                if pd.notna(store_num):
                    try:
                        store_number = str(int(float(store_num)))
                    except (ValueError, TypeError):
                        store_number = None
                else:
                    store_number = None

                ticket_data.update({
                    "store_number": store_number,
                    "priority": str(orig_row.get("Priority", "")) if pd.notna(orig_row.get("Priority")) else None,
                    "business_priority": str(orig_row.get("Business Priority", "")) if pd.notna(orig_row.get("Business Priority")) else None,
                    "description": str(orig_row.get("Description", ""))[:800] if pd.notna(orig_row.get("Description")) else None,
                    "last_comment": str(orig_row.get("Last Comment", "")) if pd.notna(orig_row.get("Last Comment")) else None,
                    "assignee": str(orig_row.get("Assignee", "")) if pd.notna(orig_row.get("Assignee")) else None,
                    "reporter": str(orig_row.get("Reporter", "")) if pd.notna(orig_row.get("Reporter")) else None,
                    "created": str(orig_row.get("Created", "")) if pd.notna(orig_row.get("Created")) else None,
                    "updated": str(orig_row.get("Updated", "")) if pd.notna(orig_row.get("Updated")) else None,
                    "blocked_status": str(orig_row.get("Blocked Status", "")) if pd.notna(orig_row.get("Blocked Status")) else None,
                    "request_status": str(orig_row.get("Request Status", "")) if pd.notna(orig_row.get("Request Status")) else None,
                    "epic_link": str(orig_row.get("Epic Link", "")) if pd.notna(orig_row.get("Epic Link")) else None,
                })

        results.append(ticket_data)

    return results


def generate_answer(query: str, tickets: list[dict]) -> str:
    """Generate an AI answer based on the query and retrieved tickets."""
    if tokenizer is None or model is None:
        return "Model not loaded"

    # Build context from tickets
    context_parts = []
    for ticket in tickets[:3]:  # Use top 3 tickets
        context_parts.append(
            f"Ticket {ticket['ticket_id']}: {ticket['summary']}\n{ticket['text'][:300]}"
        )

    context = "\n\n".join(context_parts)

    # Create prompt
    prompt = f"""Answer the question based on the following Jira tickets:

{context}

Question: {query}
Answer:"""

    # Generate response
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        max_length=512,
        truncation=True
    )

    outputs = model.generate(
        inputs.input_ids,
        max_length=150,
        num_beams=4,
        early_stopping=True,
        temperature=0.7
    )

    answer = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return answer


def get_stats() -> dict:
    """Get statistics about the ticket database."""
    if reference_df is None:
        return {}

    stats = {
        "total_tickets": len(reference_df),
        "indexed_tickets": index.ntotal if index else 0,
    }

    # Get status counts if available
    if "Status" in reference_df.columns:
        status_counts = reference_df["Status"].value_counts().to_dict()
        stats["by_status"] = status_counts
    elif "status" in reference_df.columns:
        status_counts = reference_df["status"].value_counts().to_dict()
        stats["by_status"] = status_counts

    return stats


# Routes
@app.route("/")
def index():
    """Render the main page."""
    return render_template("index.html")


@app.route("/api/search", methods=["POST"])
def search():
    """Search for tickets based on a query."""
    data = request.json
    query = data.get("query", "").strip()
    top_k = data.get("top_k", CONFIG["top_k"])

    if not query:
        return jsonify({"error": "Query is required"}), 400

    try:
        tickets = retrieve_similar_tickets(query, top_k)
        answer = generate_answer(query, tickets)

        return jsonify({
            "query": query,
            "answer": answer,
            "tickets": tickets,
            "count": len(tickets)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats")
def stats():
    """Get database statistics."""
    try:
        return jsonify(get_stats())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "models_loaded": all([encoder, tokenizer, model, index, reference_df])
    })


@app.route("/api/categories")
def categories():
    """Get ticket categories based on keywords."""
    if reference_df is None:
        return jsonify({"error": "Data not loaded"}), 500

    # Define categories based on common patterns in your tickets
    categories = {
        "Camera": {"keywords": ["camera", "ptz", "surveillance", "cctv"], "icon": "📹"},
        "Door/Access": {"keywords": ["door", "access", "lock", "entry", "ada"], "icon": "🚪"},
        "Network": {"keywords": ["network", "connectivity", "internet", "wifi", "router"], "icon": "🌐"},
        "Hardware": {"keywords": ["hardware", "replacement", "equipment", "device"], "icon": "🔧"},
        "All Tickets": {"keywords": [], "icon": "📋"}
    }

    # Count tickets per category
    category_counts = {}
    for cat_name, cat_data in categories.items():
        if cat_name == "All Tickets":
            category_counts[cat_name] = {
                "count": len(reference_df),
                "icon": cat_data["icon"]
            }
        else:
            keywords = cat_data["keywords"]
            # Count tickets matching any keyword
            mask = reference_df["Cleaned_Text"].str.contains(
                '|'.join(keywords), case=False, na=False
            )
            category_counts[cat_name] = {
                "count": mask.sum(),
                "icon": cat_data["icon"]
            }

    return jsonify(category_counts)


if __name__ == "__main__":
    # Load models before starting the server
    if load_models():
        print("=" * 80)
        print("[STARTING] RAG Jira Web Application")
        print("=" * 80)
        print("\n[INFO] Open your browser to: http://localhost:5000")
        print("\n[INFO] Press CTRL+C to stop the server\n")
        print("=" * 80 + "\n")

        app.run(debug=True, host="0.0.0.0", port=5000)
    else:
        print("\n[ERROR] Failed to load models. Please run the pipeline first:")
        print("   python run_pipeline.py\n")
