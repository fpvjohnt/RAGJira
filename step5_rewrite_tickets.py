import pandas as pd
import re

df = pd.read_csv("data/jira_reference.csv")

def rewrite_text(text):
    text = str(text)
    text = re.sub(r"[*•#_\-]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    # turn “Issue:” and “Proposed Resolution:” into plain sentences
    text = text.replace("Issue:", "The issue is")
    text = text.replace("Proposed Resolution:", "The proposed resolution is")
    text = text.replace("Status:", "Current status:")
    text = text.replace("Hello", "")
    # cut boilerplate like greetings or photo requests
    text = re.sub(r"(Thank you|Please provide|Hello.*?!)", "", text, flags=re.I)
    return text.strip()

df["text"] = df["text"].apply(rewrite_text)
df.to_csv("data/jira_reference_rewritten.csv", index=False)
print("✅ Tickets rewritten for clearer language → data/jira_reference_rewritten.csv")
