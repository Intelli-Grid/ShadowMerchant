"""
Quick DB Restore — re-activates all deals and re-tags trending.
Run before triggering a fresh scrape.

Usage (from project root):
    .venv\Scripts\python.exe scripts\quick_restore.py
"""
import os, sys, logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / '.env')
load_dotenv(dotenv_path=Path(__file__).parent.parent / 'apps' / 'web' / '.env.local', override=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

import pymongo

uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
if not uri:
    print("ERROR: MONGODB_URI not set in environment")
    sys.exit(1)

print(f"Connecting to MongoDB...")
client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=10000)
db = client.shadowmerchant

# Counts before
total    = db.deals.count_documents({})
active   = db.deals.count_documents({"is_active": True})
inactive = db.deals.count_documents({"is_active": False})
print(f"Before: total={total}  active={active}  inactive={inactive}")

# Re-activate all
if inactive > 0:
    r = db.deals.update_many({"is_active": False}, {"$set": {"is_active": True, "is_stale": False}})
    print(f"Restored {r.modified_count} deals to active")

# Clear any dangling stale flags  
db.deals.update_many({"is_stale": True}, {"$set": {"is_stale": False}})

# Re-tag top 10 as trending
db.deals.update_many({}, {"$set": {"is_trending": False}})
top = [d["_id"] for d in db.deals.find({"is_active": True}, {"_id": 1}).sort("deal_score", -1).limit(10)]
if top:
    db.deals.update_many({"_id": {"$in": top}}, {"$set": {"is_trending": True}})
    print(f"Tagged {len(top)} deals as trending")

active_after   = db.deals.count_documents({"is_active": True})
trending_after = db.deals.count_documents({"is_active": True, "is_trending": True})
print(f"After:  active={active_after}  trending={trending_after}")
client.close()
print("Done. Now run the pipeline to get fresh deals.")
