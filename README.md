# RAGJira

RAGJira contains a lightweight preprocessing and retrieval pipeline for summarising Jira camera incident tickets with retrieval-augmented generation.

## Setup

1. Create and activate a Python 3.9+ environment.
2. Install dependencies: `pip install -r requirements.txt`.
3. Place the raw Jira export in `data/` and run the pipeline scripts in order.

## Pipeline overview

1. `step1_inspect_csv.py` – quick look at the raw export to verify expected columns.
2. `step5_clean_descriptions.py` – cleans descriptions and stores them in `data/jira_cleaned_ready.csv`.
3. `step3_build_index.py` – creates embeddings, saves the FAISS index, and writes `data/jira_reference.csv`.
4. `step5_rewrite_tickets.py` – produces `Rewritten_Text` variants for clearer downstream narratives.
5. `rag_index.py` / `rag_generate.py` – optional lightweight RAG flow for experimentation.
6. `step4_generate_insights.py` – interactive or scripted analytical summary generator (see below).

## Running the analytical generator

```bash
python step4_generate_insights.py \
    --query "What patterns caused the latest outages?" \
    --top-k 8 \
    --export-tickets data/latest_retrieved_tickets.csv
```

Key options:

- `--query` lets you automate runs without manual input.
- `--top-k` controls how many similar tickets shape the context (capped by the index size).
- `--export-tickets` writes the retrieved slice (with ranks) to CSV for offline analysis or dashboarding.
- `--no-save` skips appending the generated insight to `data/generated_insights.csv`.
- `--preview-chars` trims the on-screen context preview when you only need a quick sanity check.

If the retrieved tickets are sparse or too short, the script falls back to a safe context template so the language model avoids hallucinating without evidence.

## Additional ideas

- Automate recurring reports with a cron job that invokes `step4_generate_insights.py --query ... --export-tickets ...`.
- Feed the exported ticket slice directly into Tableau/PowerBI to visualise the supporting incidents alongside the generated summary.
- Extend `rag_generate.py` with the same CLI options if you prefer the slimmer retrieval dataset for experimentation.
