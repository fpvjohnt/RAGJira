import pandas as pd

# Load your Jira CSV
df = pd.read_csv("apt_tickets_complete_cleaned.csv")

# ✅ Combine descriptive text fields into one column
df["text"] = (
    df["Summary"].fillna('') + ". " +
    df["Description"].fillna('') + ". " +
    df["Last Comment"].fillna('') + ". " +
    "Priority: " + df["Priority"].fillna('') + ", " +
    "Business Priority: " + df["Business Priority"].fillna('') + ", " +
    "Blocked Status: " + df["Blocked Status"].fillna('') + ", " +
    "Request Status: " + df["Request Status"].fillna('') + "."
)

# ✅ Remove rows with empty text
df = df[df["text"].str.strip() != ""]

# ✅ Keep only columns we’ll need later
df = df[["Ticket Key", "text"]]

# ✅ Save cleaned version
df.to_csv("data/jira_cleaned.csv", index=False)
print("✅ Jira data cleaned and saved to data/jira_cleaned.csv")
print(f"Total records after cleaning: {len(df)}")
print("\n🧩 Sample text preview:")
print(df["text"].head(3))
