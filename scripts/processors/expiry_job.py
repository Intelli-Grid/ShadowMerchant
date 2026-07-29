"""
ShadowMerchant Expiry & Trending Maintenance Job — v1.1

Runs as a daily cron/manual script. Does two things:
  1. Auto-archives deals older than 72 hours (is_active = False)
     [Matches the 72h TTL enforced by /api/cron/refresh-deals/route.ts]
  2. Re-computes and flags the top 20 deals as is_trending = True

Usage:
    python scripts/processors/expiry_job.py

Schedule via cron (every 6h):
    0 */6 * * * cd /path/to/project && .venv/bin/python scripts/processors/expiry_job.py
"""

import sys
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("expiry_job")

# Deals older than 72 hours are auto-archived.
# Matches the TTL in /api/cron/refresh-deals/route.ts (72h).
EXPIRY_HOURS = 72

# How many top deals to mark as trending
TRENDING_LIMIT = 20


def archive_stale_deals(db) -> int:
    """
    Sets is_active=False on deals that have passed their 72h expiry.
    Returns the count of archived deals.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=EXPIRY_HOURS)

    result = db.deals.update_many(
        {
            "is_active": True,
            "scraped_at": {"$lte": cutoff},
        },
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    archived = result.modified_count
    logger.info(f"Archived {archived} stale deals (> {EXPIRY_HOURS}h old).")
    return archived


def refresh_trending_flags(db) -> int:
    """
    1. Clears is_trending on ALL deals.
    2. Queries the top TRENDING_LIMIT active deals by deal_score.
    3. Sets is_trending=True on those deals.
    Returns the count of newly-trending deals.
    """
    # Clear all trending flags first
    db.deals.update_many(
        {"is_trending": True},
        {"$set": {"is_trending": False, "updated_at": datetime.now(timezone.utc)}},
    )

    # Find top deals by score among active deals
    top_deals = list(
        db.deals.find(
            {"is_active": True},
            {"_id": 1, "deal_score": 1, "title": 1},
        )
        .sort("deal_score", -1)
        .limit(TRENDING_LIMIT)
    )

    if not top_deals:
        logger.warning("No active deals found to mark as trending.")
        return 0

    top_ids = [d["_id"] for d in top_deals]
    result = db.deals.update_many(
        {"_id": {"$in": top_ids}},
        {"$set": {"is_trending": True, "updated_at": datetime.now(timezone.utc)}},
    )

    updated = result.modified_count
    logger.info(f"Marked {updated} deals as trending:")
    for d in top_deals:
        logger.info(f"  🔥 [{d.get('deal_score', 0)}] {d.get('title', 'N/A')[:60]}")

    return updated




def run():
    db = get_db()
    if db is None:
        logger.error("No DB connection. Aborting.")
        return

    logger.info("═══ ShadowMerchant Expiry & Trending Job ═══")
    start = datetime.now(timezone.utc)

    archived = archive_stale_deals(db)
    trending = refresh_trending_flags(db)

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    logger.info(
        f"═══ Job Complete in {elapsed:.1f}s — "
        f"archived={archived}, trending={trending} ═══"
    )


if __name__ == "__main__":
    run()
