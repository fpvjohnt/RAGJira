import pandas as pd

# Load your CSV
df = pd.read_csv("apt_tickets_complete_cleaned.csv")

print("\n✅ CSV successfully loaded!\n")

# Show columns
print("📊 Columns in your file:")
print(df.columns.tolist())

print("\n───────────────────────────────\n")

# Show first few rows
print("🧩 First 5 rows of data:")
print(df.head(5).to_string())

print("\n───────────────────────────────\n")

# Check for nulls
print("🔍 Null / missing values by column:")
print(df.isnull().sum())

print("\n───────────────────────────────\n")

# Quick text length overview if there’s a 'Description' or 'Resolution' column
if 'Description' in df.columns:
    print("📝 Average description length:", df['Description'].fillna('').apply(len).mean())
if 'Resolution' in df.columns:
    print("🧠 Average resolution length:", df['Resolution'].fillna('').apply(len).mean())
