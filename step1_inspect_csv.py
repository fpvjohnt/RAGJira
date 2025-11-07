import pandas as pd

# Load your CSV
df = pd.read_csv("apt_tickets_complete_cleaned.csv")

# Show basic info
print("\n✅ CSV successfully loaded!\n")
print("📊 Columns in your file:")
print(df.columns.tolist())

print("\n🧩 First 5 rows:")
print(df.head(5))
