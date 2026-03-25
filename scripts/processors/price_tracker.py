"""
Price tracker — updates the price_history array on existing deals.
Run after scraper: python scripts/processors/price_tracker.py
"""
import sys
import logging
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def update_price_history(db, deal_id: str, current_price: float) -> bool:
    """
    Appends today's price to the deal's price_history array if a new day has started.
    Returns True if an update was made.
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    deal = db.deals.find_one({"_id": deal_id}, {"price_history": 1})
    if not deal:
        return False

    history = deal.get("price_history", [])

    # Avoid duplicate entries for the same day
    if history:
        last_date = history[-1].get("date")
        if last_date and last_date >= today:
            return False  # Already recorded today

    db.deals.update_one(
        {"_id": deal_id},
        {"$push": {"price_history": {"date": today, "price": current_price}}}
    )
    return True


def run_price_tracker():
    db = get_db()
    if db is None:
        logging.error("No DB connection.")
        return

    deals = list(db.deals.find({"is_active": True}, {"_id": 1, "discounted_price": 1, "title": 1}))
    logging.info(f"Tracking prices for {len(deals)} active deals")

    updated = 0
    for deal in deals:
        try:
            was_updated = update_price_history(db, deal["_id"], deal["discounted_price"])
            if was_updated:
                updated += 1
        except Exception as e:
            logging.error(f"Error updating price for {deal.get('title', '')[:30]}: {e}")

    logging.info(f"✅ Price history updated for {updated}/{len(deals)} deals")


if __name__ == "__main__":
    run_price_tracker()
