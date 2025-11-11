# RAG Jira Pipeline

This repository contains a set of small, composable scripts that build a
retrieval-augmented generation (RAG) workflow around Jira incident
tickets. The pipeline progressively cleans the exported CSV, generates
embeddings, and finally produces natural-language insights about the
queue.

## Quick Start

**The easiest way to run everything:**

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Place your Jira export CSV at the repository root
# (default: apt_tickets_complete_cleaned.csv)

# 3. Run the complete pipeline
python run_pipeline.py
```

This will guide you through all steps and launch the chatbot when ready!

## Getting started (Manual Steps)

If you prefer to run each step individually:

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Verify the data export** – place `apt_tickets_complete_cleaned.csv`
   at the repository root. The cleaning scripts expect this file.

3. **Run the pipeline**
   | Step | Script | Purpose |
   | ---- | ------ | ------- |
   | 1 | `step1_inspect_csv.py` | Inspect the raw export and confirm the column layout. |
   | 2 | `step5_clean_descriptions.py` | Produce a curated text column (`Cleaned_Text`) with markdown, boilerplate, and labels normalised. |
   | 3 | `step3_build_index.py` | Embed the cleaned descriptions with SentenceTransformers and create a FAISS index alongside reference metadata. |
   | 4 | `step4_generate_insights.py` | Interactively retrieve similar tickets and draft summaries with FLAN-T5. |
   | 5 | `chatbot.py` | Launch the interactive chatbot for natural language queries. |

   The companion scripts `rag_index.py`, `rag_query.py`, and
   `rag_generate.py` provide a lightweight sample workflow using the
   smaller dataset in `data/sample_docs.csv`.

## Advanced Pipeline Options

```bash
# Run only specific steps
python run_pipeline.py --steps inspect,clean,index

# Skip the chatbot launch
python run_pipeline.py --no-chatbot

# Use a custom input file
python run_pipeline.py --input my_custom_tickets.csv
```

## Web Interface (Recommended)

Launch the modern, interactive web UI:

```bash
python web_app.py
```

Then open your browser to: **http://localhost:5000**

The web interface provides:
- 🎨 Modern dark theme inspired by Google Finance
- 📊 Real-time statistics dashboard
- 🔍 Interactive search with smart suggestions
- 📋 Visual ticket results with relevance scores
- 🤖 AI-powered answers with context
- 💡 One-click example queries

## Command-Line Chatbot

Alternatively, use the terminal-based chatbot:

```bash
# Run the chatbot with default settings
python chatbot.py

# Customize the models and data sources
python chatbot.py \
    --index data/jira_index.faiss \
    --reference data/jira_reference.csv \
    --llm-model google/flan-t5-base \
    --top-k 5
```

Example queries:
- "What are the most common login issues?"
- "Show me tickets about password reset"
- "What problems are related to the API?"

The chatbot will:
1. Retrieve the most similar tickets from the FAISS index
2. Display the relevant tickets with summaries
3. Generate a natural language answer based on the context

Type `quit`, `exit`, or `q` to stop the chatbot.

## Rewriting ticket descriptions

Use `step5_rewrite_tickets.py` to create human-readable versions of the
cleaned descriptions. The script now includes a command-line interface
with sensible defaults and guard rails.

```bash
# Preview five rewritten tickets without touching the filesystem
python step5_rewrite_tickets.py --dry-run

# Persist the rewritten text to a new column
python step5_rewrite_tickets.py \
    --input data/jira_reference.csv \
    --output data/jira_reference_rewritten.csv \
    --output-column Rewritten_Text

# Overwrite the original Cleaned_Text column in place
python step5_rewrite_tickets.py --overwrite-source
```

Key features:

- Automatically detects the best column to process (`Cleaned_Text` by
  default, falling back to `text` when required).
- Normalises markdown, HTML, and whitespace noise.
- Removes support greetings and boilerplate phrases.
- Provides a `--dry-run` mode to inspect the result without saving it.

## Tips for extension

- Extract common functionality (e.g., embedding, cleaning) into
  dedicated modules when the scripts start sharing more logic.
- Add argument parsing to the remaining scripts to make their behaviour
  configurable instead of relying on hard-coded values.
- Consider persisting configuration (model names, index paths, retrieval
  parameters) into a YAML/JSON file for easier automation.
- Add smoke tests or notebooks that validate retrieval quality on a
  labelled subset of tickets.

With these utilities in place you can iteratively improve the Jira RAG
workflow while keeping each step transparent and debuggable.
