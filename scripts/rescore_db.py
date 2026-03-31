import os
import pymongo
from dotenv import load_dotenv
from processors.deal_scorer import score_deal_with_breakdown

load_dotenv()

client = pymongo.MongoClient(os.getenv("MONGODB_URI"))
db = client["shadowmerchant"]

deals = list(db.deals.find({"is_active": True}))

print(f"Recalculating scores for {len(deals)} active deals...")

updates = []
for doc in deals:
    score, breakdown = score_deal_with_breakdown(doc)
    updates.append(pymongo.UpdateOne(
        {"_id": doc["_id"]},
        {"$set": {"deal_score": score, "score_breakdown": breakdown, "is_trending": False}}
    ))

if updates:
    db.deals.bulk_write(updates)

print("Scores updated. Applying new trending logic to Top 8 deals...")

# Re-apply is_trending to top 8 deals that have a score of at least 10
# (Just so we have items even if none hit an absurdly high score)
top_deals = db.deals.find({"is_active": True, "deal_score": {"$gte": 10}}).sort("deal_score", -1).limit(8)
top_ids = [d["_id"] for d in top_deals]

if top_ids:
    db.deals.update_many(
        {"_id": {"$in": top_ids}},
        {"$set": {"is_trending": True}}
    )

print(f"Set {len(top_ids)} deals to trending. Top deal IDs: {top_ids}")
print("Update script completed successfully.")
