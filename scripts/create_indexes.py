import os
import sys
import pymongo
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")
if not MONGO_URI:
    print("MONGO_URI not found in env.")
    sys.exit(1)

client = pymongo.MongoClient(MONGO_URI)
db = client.shadowmerchant

print("Creating MongoDB Indexes...")

indexes = [
    [("is_active", pymongo.ASCENDING), ("is_trending", pymongo.ASCENDING), ("deal_score", pymongo.DESCENDING)],
    [("is_active", pymongo.ASCENDING), ("scraped_at", pymongo.DESCENDING), ("deal_score", pymongo.DESCENDING)],
    [("is_active", pymongo.ASCENDING), ("category", pymongo.ASCENDING), ("deal_score", pymongo.DESCENDING)],
    [("is_active", pymongo.ASCENDING), ("source_platform", pymongo.ASCENDING), ("deal_score", pymongo.DESCENDING)],
]

for idx in indexes:
    print(f"Creating index: {idx}")
    db.deals.create_index(idx)

# Unique index on affiliate_url
print("Creating unique index on affiliate_url...")
try:
    db.deals.create_index([("affiliate_url", pymongo.ASCENDING)], unique=True)
except Exception as e:
    print(f"Warning: could not create unique index on affiliate_url: {e}")

print("Indexes created successfully.")
client.close()
