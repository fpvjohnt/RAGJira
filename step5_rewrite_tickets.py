from pathlib import Path
import pandas as pd
import re

REFERENCE_PATH = Path("data/jira_reference.csv")
OUTPUT_PATH = Path("data/jira_reference_rewritten.csv")

if not REFERENCE_PATH.exists():
    raise FileNotFoundError(
        "❌ data/jira_reference.csv is missing. Run step3_build_index.py first to "
        "generate the cleaned reference file."
    )

df = pd.read_csv(REFERENCE_PATH)

if "Cleaned_Text" not in df.columns:
    raise KeyError(
        "❌ Expected a 'Cleaned_Text' column in data/jira_reference.csv. "
        "Confirm step5_clean_descriptions.py and step3_build_index.py completed successfully."
    )


def rewrite_text(text: str) -> str:
    """Lightly rewrite Jira ticket narratives for clarity."""

    text = str(text)
    text = re.sub(r"[*•#_\-]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    # turn structured headings into plain sentences
    text = re.sub(r"\bIssue:?", "The issue is", text, flags=re.I)
    text = re.sub(r"\bProposed Resolution:?", "The proposed resolution is", text, flags=re.I)
    text = re.sub(r"\bResolution:?", "The resolution was", text, flags=re.I)
    text = re.sub(r"\bStatus:?", "Current status:", text, flags=re.I)
    # cut boilerplate like greetings or photo requests
    text = re.sub(r"(Thank you|Please provide|Hello.*?!)", "", text, flags=re.I)
    return text.strip()


df["Rewritten_Text"] = df["Cleaned_Text"].apply(rewrite_text)
df.to_csv(OUTPUT_PATH, index=False)
print("✅ Tickets rewritten for clearer language → data/jira_reference_rewritten.csv")
