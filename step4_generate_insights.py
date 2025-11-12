"""Interactive (or scripted) analytical summariser for Jira incidents."""

from __future__ import annotations

import argparse
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


DEFAULT_INDEX_PATH = Path("data/jira_index.faiss")
DEFAULT_REFERENCE_PATH = Path("data/jira_reference.csv")
DEFAULT_REPORT_PATH = Path("data/generated_insights.csv")


@dataclass
class RetrievalBundle:
    """Convenience container for FAISS results."""

    distances: np.ndarray
    indices: np.ndarray


def wait_for_terminal(delay_seconds: float = 1.0) -> None:
    """Give terminals (especially VS Code) a short moment before prompting."""

    if delay_seconds > 0:
        time.sleep(delay_seconds)


def load_index(index_path: Path) -> faiss.Index:
    if not index_path.exists():
        raise FileNotFoundError(
            f"❌ Could not find {index_path}. Run step3_build_index.py to generate it first."
        )

    index = faiss.read_index(str(index_path))

    if index.ntotal == 0:
        raise ValueError(
            "❌ The FAISS index is empty. Re-run step3_build_index.py after preparing data."
        )

    return index


def load_reference(reference_path: Path) -> pd.DataFrame:
    if not reference_path.exists():
        raise FileNotFoundError(
            f"❌ Could not find {reference_path}. Ensure step3_build_index.py completed successfully."
        )

    df = pd.read_csv(reference_path)

    if df.empty:
        raise ValueError(
            "❌ The Jira reference file is empty. Verify earlier preprocessing steps produced data."
        )

    return df


def retrieve(index: faiss.Index, query: str, embedder: SentenceTransformer, top_k: int) -> RetrievalBundle:
    query_vector = embedder.encode([query])
    k = min(top_k, index.ntotal)
    distances, indices = index.search(np.array(query_vector, dtype=np.float32), k)
    return RetrievalBundle(distances=distances, indices=indices)


def _clean_text(text: str) -> str:
    text = re.sub(r"[*•#_\-]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


def build_context(
    df: pd.DataFrame,
    bundle: RetrievalBundle,
    min_alpha_chars: int,
    available_columns: Iterable[str],
) -> tuple[str, List[int]]:
    context_parts: List[str] = []
    valid_indices: List[int] = []

    for idx in bundle.indices[0]:
        if idx == -1 or idx >= len(df):
            continue

        row = df.iloc[idx]
        text = next(
            (
                str(row[col])
                for col in available_columns
                if col in df.columns and pd.notna(row[col]) and str(row[col]).strip()
            ),
            "",
        )

        text = _clean_text(text)

        if not text:
            continue
        if re.fullmatch(r"[\d\W_]+", text):
            continue
        if len(re.findall(r"[A-Za-z]", text)) < min_alpha_chars:
            continue

        context_parts.append(text)
        valid_indices.append(idx)

    context = " ".join(context_parts)
    return context, valid_indices


def fallback_context(context: str, min_length: int) -> str:
    if len(context.strip()) >= min_length:
        return context

    return (
        "Incident descriptions are brief or contain limited text. "
        "Assume these involve hardware faults, network issues, or vendor delays "
        "causing camera outages in retail stores."
    )


def build_prompt(context: str) -> str:
    return (
        "You are a senior data analyst summarizing camera-related incidents from Jira maintenance logs. "
        f"Below are extracted ticket details:\n{context}\n\n"
        "Write a structured executive summary with the following sections:\n\n"
        "**Findings:** Summarize key recurring problems observed across the tickets.\n"
        "**Root Causes:** Identify likely underlying causes (e.g., hardware, network, vendor coordination).\n"
        "**Recommendations:** Provide 2–3 concise, actionable recommendations to prevent future incidents.\n\n"
        "Write in professional, clear English suitable for presentation in a Tableau dashboard or weekly IT summary."
    )


def save_report(report_path: Path, query: str, answer: str) -> None:
    os.makedirs(report_path.parent, exist_ok=True)

    if not report_path.exists():
        pd.DataFrame(columns=["timestamp", "query", "insight"]).to_csv(report_path, index=False)

    new_record = pd.DataFrame(
        [[datetime.now().strftime("%Y-%m-%d %H:%M:%S"), query, answer]],
        columns=["timestamp", "query", "insight"],
    )
    new_record.to_csv(report_path, mode="a", header=False, index=False)


def export_retrieved_rows(df: pd.DataFrame, indices: List[int], export_path: Path) -> None:
    if not indices:
        print("⚠️ No valid tickets retrieved, so nothing was exported.")
        return

    export_df = df.iloc[indices].copy()
    export_df.insert(0, "retrieval_rank", range(1, len(indices) + 1))
    export_df.to_csv(export_path, index=False)
    print(f"🗂️ Retrieved ticket snapshot saved to: {export_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", help="Question to analyse. Falls back to interactive prompt if omitted.")
    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Maximum number of tickets to retrieve from the FAISS index (default: 10).",
    )
    parser.add_argument(
        "--min-context-chars",
        type=int,
        default=10,
        help="Minimum alphabetic characters required in a ticket before it contributes to context.",
    )
    parser.add_argument(
        "--min-context-length",
        type=int,
        default=100,
        help="Minimum combined context length before falling back to the generic template.",
    )
    parser.add_argument(
        "--index-path", type=Path, default=DEFAULT_INDEX_PATH, help="Path to the FAISS index file."
    )
    parser.add_argument(
        "--reference-path",
        type=Path,
        default=DEFAULT_REFERENCE_PATH,
        help="Path to the reference CSV produced during indexing.",
    )
    parser.add_argument(
        "--report-path",
        type=Path,
        default=DEFAULT_REPORT_PATH,
        help="Path to append generated insights (default: data/generated_insights.csv).",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Skip persisting the generated insight to disk.",
    )
    parser.add_argument(
        "--export-tickets",
        type=Path,
        help="Optional CSV path to store the retrieved ticket slice for further analysis.",
    )
    parser.add_argument(
        "--preview-chars",
        type=int,
        default=800,
        help="Number of characters to show from the assembled context preview.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.top_k <= 0:
        raise ValueError("--top-k must be a positive integer.")

    if args.min_context_chars < 1:
        raise ValueError("--min-context-chars must be at least 1.")

    wait_for_terminal()

    print("📂 Loading Jira index and data...")
    index = load_index(args.index_path)
    df = load_reference(args.reference_path)
    print(f"✅ Loaded {len(df)} Jira records.\n")

    print("🔄 Loading models (this may take ~15 seconds)...")
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")
    generator = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
    print("✅ Models ready!\n")

    query = (args.query or input("Ask your Jira analytical question: ")).strip()
    if not query:
        raise ValueError("❌ A query is required to generate insights.")

    bundle = retrieve(index, query, embedder, top_k=args.top_k)
    available_columns = [col for col in ("Rewritten_Text", "Cleaned_Text", "text") if col in df.columns]
    context, valid_indices = build_context(
        df,
        bundle,
        min_alpha_chars=args.min_context_chars,
        available_columns=available_columns,
    )

    context = fallback_context(context, min_length=args.min_context_length)

    print("\n🧩 Retrieved context preview:\n")
    print(context[: args.preview_chars])
    print("\n──────────────────────────────────────────────\n")

    prompt = build_prompt(context)
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True)
    outputs = generator.generate(**inputs, max_length=700, num_beams=4)
    answer = tokenizer.decode(outputs[0], skip_special_tokens=True)

    print("\n📊 Query:", query)
    print("\n🧠 Insight:\n", answer)

    if args.export_tickets:
        export_retrieved_rows(df, valid_indices, args.export_tickets)

    if not args.no_save:
        save_report(args.report_path, query, answer)
        print(f"\n🗂️ Insight saved to: {args.report_path}")
    else:
        print("\n💾 Insight persistence disabled (--no-save).")


if __name__ == "__main__":
    main()
