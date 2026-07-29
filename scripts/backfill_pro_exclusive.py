"""
backfill_pro_exclusive.py
─────────────────────────
One-shot script to retroactively apply the Pro-exclusive rule to all
existing deals in MongoDB.

Rule (same as run_pipeline.py, scheduler.py, deal_processor.py):
  is_pro_exclusive = True  iff  deal_score >= 55  AND  discount_percent >= 40
  (Threshold calibrated 2026-07-26: sigmoid scorer caps at ~66 for fashion/cosmetics)

Run from: E:\\workspace\\projects\\tier-0-revenue\\shadow-merchant\\scripts\\
Command:  python backfill_pro_exclusive.py [--dry-run]

Dry-run prints stats without writing anything.
"""

import os
import sys
import pymongo
from dotenv import load_dotenv

load_dotenv()

DRY_RUN = "--dry-run" in sys.argv

client = pymongo.MongoClient(os.getenv("MONGODB_URI"))
db = client["shadowmerchant"]

print(f"{'[DRY RUN] ' if DRY_RUN else ''}Scanning all active deals...")

deals = list(db.deals.find(
    {"is_active": True},
    {"_id": 1, "deal_score": 1, "discount_percent": 1, "is_pro_exclusive": 1}
))

print(f"Found {len(deals)} active deals")

should_be_pro   = []   # IDs that qualify for Pro-exclusive
should_be_free  = []   # IDs currently pro but shouldn't be
already_correct = 0

for doc in deals:
    score    = int(doc.get("deal_score", 0) or 0)
    discount = int(doc.get("discount_percent", 0) or 0)
    current  = bool(doc.get("is_pro_exclusive", False))
    target   = bool(score >= 55 and discount >= 40)

    if target == current:
        already_correct += 1
    elif target and not current:
        should_be_pro.append(doc["_id"])
    elif not target and current:
        should_be_free.append(doc["_id"])

print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Results:")
print(f"  Already correct:         {already_correct}")
print(f"  Need to mark PRO:        {len(should_be_pro)}")
print(f"  Need to unmark (FREE):   {len(should_be_free)}")
print(f"  Total Pro after fix:     {len(should_be_pro) + sum(1 for d in deals if d.get('is_pro_exclusive') and d['_id'] not in should_be_free)}")

if DRY_RUN:
    print("\n[DRY RUN] No changes written. Re-run without --dry-run to apply.")
    sys.exit(0)

updates = []
if should_be_pro:
    updates.append(pymongo.UpdateMany(
        {"_id": {"$in": should_be_pro}},
        {"$set": {"is_pro_exclusive": True}}
    ))
if should_be_free:
    updates.append(pymongo.UpdateMany(
        {"_id": {"$in": should_be_free}},
        {"$set": {"is_pro_exclusive": False}}
    ))

if updates:
    result = db.deals.bulk_write(updates)
    print(f"\nWritten: {result.modified_count} deals updated.")
else:
    print("\nNo changes needed — all deals already correct.")

print("Backfill complete.")
