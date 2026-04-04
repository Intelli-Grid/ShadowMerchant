"""One-off script: applies the new professional trending algorithm to existing DB deals."""
import sys, os, math
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
os.chdir(Path(__file__).parent)

from dotenv import load_dotenv
load_dotenv()

import pymongo
client = pymongo.MongoClient(
    os.getenv("MONGO_URI") or os.getenv("MONGODB_URI"),
    serverSelectionTimeoutMS=10000
)
db = client.shadowmerchant
now_utc = datetime.utcnow()

candidates = list(db.deals.find(
    {"is_active": True, "original_price": {"$gte": 500}, "discount_percent": {"$gte": 20}},
    {"_id": 1, "original_price": 1, "discounted_price": 1, "discount_percent": 1,
     "deal_score": 1, "rating": 1, "rating_count": 1, "scraped_at": 1, "source_platform": 1, "title": 1}
))
print(f"Qualifying candidates: {len(candidates)}")

def trending_score(d):
    orig   = float(d.get("original_price", 0) or 0)
    disc   = float(d.get("discounted_price", 0) or 0)
    pct    = float(d.get("discount_percent", 0) or 0)
    ai     = float(d.get("deal_score", 0) or 0)
    rating = float(d.get("rating", 0) or 0)
    rcount = int(d.get("rating_count", 0) or 0)
    s_at   = d.get("scraped_at", now_utc)

    savings  = min((orig - disc) / 100.0, 100.0)
    discount = min(pct, 100.0)

    if orig >= 15000:  tier = 100.0
    elif orig >= 5000: tier = 75.0
    elif orig >= 2000: tier = 50.0
    elif orig >= 1000: tier = 35.0
    else:              tier = 15.0

    social = min((rating / 5.0) * math.log10(rcount + 1) * 20, 100.0)
    hours_old = (now_utc - s_at).total_seconds() / 3600 if isinstance(s_at, datetime) else 0
    freshness = max(0.0, 100.0 - (hours_old / 12.0 * 100.0))

    return savings*0.30 + discount*0.20 + tier*0.20 + ai*0.20 + social*0.05 + freshness*0.05

scored = sorted(
    [{"deal": d, "score": trending_score(d)} for d in candidates],
    key=lambda x: x["score"], reverse=True
)

selected = []
platform_count = {}
for item in scored:
    p = item["deal"].get("source_platform", "unknown")
    if platform_count.get(p, 0) < 3:
        selected.append(item)
        platform_count[p] = platform_count.get(p, 0) + 1
    if len(selected) == 10:
        break

db.deals.update_many({}, {"$set": {"is_trending": False, "trending_score": 0}})
for item in selected:
    db.deals.update_one(
        {"_id": item["deal"]["_id"]},
        {"$set": {"is_trending": True, "trending_score": round(item["score"], 2)}}
    )

print(f"\n✅ Tagged {len(selected)} trending deals")
print(f"   Platform spread: {platform_count}")
print(f"\n   Top 10:")
for i, item in enumerate(selected, 1):
    d = item["deal"]
    title = d.get("title", "?")[:55]
    print(f"   {i:2}. [{d.get('source_platform','?'):8}] ₹{d.get('original_price',0):>8,.0f} → {d.get('discount_percent',0):2}% off  score={item['score']:5.1f}  {title}")

client.close()
