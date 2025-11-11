# Quick Start Guide

## 🚀 Launch Everything in One Command

```bash
python run_pipeline.py
```

This single command will:
1. ✅ Inspect your CSV file
2. ✅ Clean the ticket descriptions
3. ✅ Build the FAISS search index
4. ✅ (Optional) Generate sample insights
5. ✅ Launch the interactive chatbot

## 📋 What You Need

1. **Python 3.8+** installed
2. **Your Jira export CSV** named `apt_tickets_complete_cleaned.csv` in the repository root
3. **Dependencies installed**: `pip install -r requirements.txt`

## 💬 Using the Interface

You have **two options** to interact with your RAG system:

### Option 1: Web Interface (Recommended) 🌐

Launch the modern web UI:
```bash
python web_app.py
```

Then open your browser to: **http://localhost:5000**

Features:
- 🎨 Modern dark theme interface
- 📊 Real-time statistics dashboard
- 🔍 Interactive search with suggestions
- 📋 Visual ticket results with relevance scores
- 🤖 AI-powered answers

### Option 2: Command-Line Chatbot 💻

Launch the terminal-based chatbot:
```bash
python chatbot.py
```

Ask questions like:
```
You: What are the most common login issues?
You: Show me tickets about password reset
You: What problems are related to the API?
You: Find tickets with database errors
```

Type `quit`, `exit`, or `q` to stop.

## 🔧 Advanced Usage

### Run Only Specific Steps

```bash
# Just build the index (skip insights and chatbot)
python run_pipeline.py --steps inspect,clean,index --no-chatbot

# Only run the chatbot (if index already exists)
python chatbot.py
```

### Customize the Chatbot

```bash
# Use a larger language model
python chatbot.py --llm-model google/flan-t5-base

# Retrieve more tickets per query
python chatbot.py --top-k 5

# Use custom data files
python chatbot.py --index data/my_index.faiss --reference data/my_data.csv
```

### Rewrite Ticket Text

```bash
# Preview improved ticket descriptions
python step5_rewrite_tickets.py --dry-run

# Save rewritten tickets to a new file
python step5_rewrite_tickets.py --output data/tickets_improved.csv
```

## 📁 What Gets Created

After running the pipeline, you'll have:

```
data/
├── jira_index.faiss          # FAISS search index
├── jira_reference.csv        # Cleaned tickets with metadata
├── jira_cleaned.csv          # Intermediate cleaned data
└── generated_insights.csv    # Sample insights (if generated)
```

## 🆘 Troubleshooting

**Problem**: "Input file not found"
- **Solution**: Make sure `apt_tickets_complete_cleaned.csv` is in the repository root

**Problem**: "Index file not found" when running chatbot
- **Solution**: Run `python step3_build_index.py` first to create the index

**Problem**: Models downloading slowly
- **Solution**: First run will download models (can take 5-10 minutes). They're cached for future use.

**Problem**: Out of memory error
- **Solution**: Use a smaller model like `google/flan-t5-small` or reduce `--top-k`

## 🎯 Workflow Summary

```
CSV File (Jira Export)
    ↓
step1_inspect_csv.py → View structure
    ↓
step5_clean_descriptions.py → Clean text
    ↓
step3_build_index.py → Create FAISS index
    ↓
chatbot.py → Interactive queries!
```

## 📖 Next Steps

- Explore the [README.md](README.md) for detailed documentation
- Check out individual script options with `python script.py --help`
- Customize the pipeline for your specific needs
