"""
Algolia Indexer — pushes all active deals from MongoDB to the Algolia search index.
Run after pipeline: python scripts/index_algolia.py
"""
import sys
import os
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / '.env')
sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def deal_to_record(deal: dict) -> dict:
    """Convert a MongoDB deal document to an Algolia record."""
    return {
        "objectID": str(deal["_id"]),
        "_id": str(deal["_id"]),
        "title": deal.get("title", ""),
        "description": deal.get("description", ""),
        "source_platform": deal.get("source_platform", ""),
        "original_price": deal.get("original_price", 0),
        "discounted_price": deal.get("discounted_price", 0),
        "discount_percent": deal.get("discount_percent", 0),
        "affiliate_url": deal.get("affiliate_url", ""),
        "image_url": deal.get("image_url", ""),
        "category": deal.get("category", ""),
        "brand": deal.get("brand", ""),
        "rating": deal.get("rating", 0),
        "deal_score": deal.get("deal_score", 0),
        "is_pro_exclusive": deal.get("is_pro_exclusive", False),
        "is_active": deal.get("is_active", True),
        "published_at": str(deal.get("published_at", "")),
    }


async def index_deals_async():
    from algoliasearch.search.client import SearchClient

    app_id = os.getenv("ALGOLIA_APP_ID")
    admin_key = os.getenv("ALGOLIA_ADMIN_KEY")
    if not app_id or not admin_key:
        logging.error("ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY must be set in scripts/.env")
        return

    db = get_db()
    if db is None:
        logging.error("No DB connection.")
        return

    index_name = os.getenv("ALGOLIA_INDEX_NAME", "Shadow_Merchant")
    deals = list(db.deals.find({"is_active": True}))
    logging.info(f"Indexing {len(deals)} deals to Algolia index '{index_name}'")

    if not deals:
        logging.info("No deals to index.")
        return

    records = [deal_to_record(d) for d in deals]

    async with SearchClient(app_id, admin_key) as client:
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            await client.save_objects(index_name=index_name, objects=batch)
            logging.info(f"  Indexed batch {i // batch_size + 1} ({len(batch)} records)")

    logging.info(f"Algolia indexing complete. {len(records)} deals indexed.")


def index_deals():
    asyncio.run(index_deals_async())


if __name__ == "__main__":
    index_deals()
