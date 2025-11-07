import pandas as pd
import re
import os

# Load your raw Jira CSV
df = pd.read_csv("apt_tickets_complete_cleaned.csv")

def clean_text(text):
    if pd.isna(text):
        return ""
    text = str(text)

    # Remove markdown bullets and extra symbols
    text = re.sub(r"[*•#_\-]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)

    # Replace labels with natural phrasing
    text = re.sub(r"\bIssue:?","The issue is", text, flags=re.I)
    text = re.sub(r"\bResolution:?","The resolution was", text, flags=re.I)
    text = re.sub(r"\bProposed Resolution:?","The proposed resolution is", text, flags=re.I)
    text = re.sub(r"\bStatus:?","Current status:", text, flags=re.I)

    # Remove URLs and email links
    text = re.sub(r"http\S+|www\S+|\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"\[.*?\|mailto:[^\]]*\]", "", text)

    # Remove excess punctuation, greetings, boilerplate
    text = re.sub(r"Thank you.*", "", text, flags=re.I)
    text = re.sub(r"Hello.*?!", "", text, flags=re.I)

    # Normalize spacing
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text

# Combine key columns for context
df["Combined_Text"] = (
    df["Summary"].fillna('') + ". " +
    df["Description"].fillna('') + " " +
    df["Last Comment"].fillna('')
)

# Apply cleaning
df["Cleaned_Text"] = df["Combined_Text"].apply(clean_text)

# Drop empty rows
df = df[df["Cleaned_Text"].str.strip() != ""]

# Keep key fields
df_out = df[["Ticket Key", "Store Number", "Status", "Priority", "Business Priority", "Cleaned_Text"]]

# Save to clean file
os.makedirs("data", exist_ok=True)
df_out.to_csv("data/jira_cleaned_ready.csv", index=False)

print(f"✅ Cleaned Jira text saved → data/jira_cleaned_ready.csv")
print(f"Total cleaned tickets: {len(df_out)}")
print("\n🧩 Sample preview:\n")
print(df_out.head(3).to_string(index=False))
