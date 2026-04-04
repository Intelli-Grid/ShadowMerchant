"""
Emergency restore + fresh scrape script.

1. Re-activate all deals that exist in MongoDB (undo any stale-wipe)
2. Run a fresh Meesho scrape (API-based, fastest, most reliable)
3. After scrape, re-tag trending

Run from scripts/ directory:
    .venv\Scripts\python.exe restore_and_scrape.py
"""
import os, sys, logging
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("restore")

import pymongo

uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
if not uri:
    logger.error("No MONGODB_URI found in environment!")
    sys.exit(1)

client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=10000)
db = client.shadowmerchant

# ── Step 1: Diagnose ─────────────────────────────────────────
total    = db.deals.count_documents({})
active   = db.deals.count_documents({"is_active": True})
inactive = db.deals.count_documents({"is_active": False})
stale    = db.deals.count_documents({"is_stale": True})
logger.info(f"DB state — total:{total}  active:{active}  inactive:{inactive}  stale:{stale}")

# ── Step 2: Re-activate all deals (emergency restore) ────────
if inactive > 0:
    result = db.deals.update_many(
        {"is_active": False},
        {"$set": {"is_active": True, "is_stale": False}}
    )
    logger.info(f"Restored {result.modified_count} inactive deals → active")
else:
    logger.info("All deals already active — no restore needed")

# ── Step 3: Tag top 10 as trending ───────────────────────────
db.deals.update_many({}, {"$set": {"is_trending": False}})
top_ids = [d["_id"] for d in db.deals.find(
    {"is_active": True}, {"_id": 1}
).sort("deal_score", -1).limit(10)]
if top_ids:
    db.deals.update_many({"_id": {"$in": top_ids}}, {"$set": {"is_trending": True}})
    logger.info(f"Tagged {len(top_ids)} deals as trending")

active_after = db.deals.count_documents({"is_active": True})
trending_after = db.deals.count_documents({"is_active": True, "is_trending": True})
logger.info(f"After restore — active:{active_after}  trending:{trending_after}")
client.close()

# ── Step 4: Run a fresh Meesho scrape ────────────────────────
logger.info("Starting fresh Meesho scrape...")
try:
    from scrapers.meesho_scraper import MeeshoScraper
    scraper = MeeshoScraper()
    deals = scraper.scrape_deals()
    logger.info(f"Meesho: {len(deals)} deals scraped")
except Exception as e:
    logger.error(f"Meesho scrape error: {e}")
    deals = []

# ── Step 5: Save fresh deals to MongoDB ──────────────────────
if deals:
    import uuid
    from processors.deal_scorer import score_deal_with_breakdown
    from processors.deduplicator import deduplicate_deals

    deduped = deduplicate_deals(deals)
    logger.info(f"After dedup: {len(deduped)}")

    client2 = pymongo.MongoClient(uri, serverSelectionTimeoutMS=10000)
    db2 = client2.shadowmerchant
    saved = 0

    for deal in deduped:
        try:
            def _f(field, default=""):
                return getattr(deal, field, default) if not isinstance(deal, dict) else deal.get(field, default)

            title       = str(_f("title", "")).strip()
            platform    = str(_f("platform", "meesho"))
            orig_price  = float(_f("original_price", 0) or 0)
            disc_price  = float(_f("discounted_price", 0) or 0)
            product_url = str(_f("product_url", "") or "").strip()
            image_url   = str(_f("image_url", "") or "").strip()
            category    = str(_f("category", "fashion") or "fashion")
            disc_pct    = int(round((1 - disc_price / orig_price) * 100)) if orig_price > disc_price > 0 else 0

            if not title or disc_price <= 0 or not product_url:
                continue

            deal_score, score_breakdown = score_deal_with_breakdown(deal)

            doc = {
                "title": title, "source_platform": platform,
                "original_price": orig_price, "discounted_price": disc_price,
                "discount_percent": disc_pct, "deal_score": int(deal_score),
                "score_breakdown": score_breakdown, "affiliate_url": product_url,
                "image_url": image_url, "category": category,
                "brand": str(_f("brand", "") or ""),
                "rating": float(_f("rating", 0) or 0),
                "rating_count": int(_f("rating_count", 0) or 0),
                "is_active": True, "is_stale": False, "is_pro_exclusive": False,
                "scraped_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
            }

            result = db2.deals.update_one(
                {"affiliate_url": product_url},
                {
                    "$set": doc,
                    "$push": {"price_history": {"$each": [{"date": datetime.utcnow(), "price": disc_price}], "$slice": -30}},
                    "$setOnInsert": {"created_at": datetime.utcnow(), "published_at": datetime.utcnow(), "deal_id": str(uuid.uuid4())},
                },
                upsert=True,
            )
            if result.upserted_id or result.modified_count:
                saved += 1
        except Exception as e:
            pass

    # Re-tag trending after fresh scrape
    db2.deals.update_many({}, {"$set": {"is_trending": False}})
    top_ids2 = [d["_id"] for d in db2.deals.find({"is_active": True}, {"_id": 1}).sort("deal_score", -1).limit(10)]
    if top_ids2:
        db2.deals.update_many({"_id": {"$in": top_ids2}}, {"$set": {"is_trending": True}})

    final_active = db2.deals.count_documents({"is_active": True})
    final_trending = db2.deals.count_documents({"is_active": True, "is_trending": True})
    logger.info(f"Saved {saved} Meesho deals. DB: active={final_active} trending={final_trending}")
    client2.close()

# ── Step 6: Sync Algolia ──────────────────────────────────────
logger.info("Syncing Algolia...")
try:
    import subprocess
    subprocess.run([sys.executable, "index_algolia.py"], cwd=str(Path(__file__).parent), timeout=120)
    logger.info("Algolia sync complete")
except Exception as e:
    logger.error(f"Algolia sync error: {e}")

logger.info("=== Done. Flush Redis cache in Vercel to show fresh data. ===")
