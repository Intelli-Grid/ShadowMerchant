import os
import asyncio
import logging
from algoliasearch.search.client import SearchClient

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

async def _push_to_algolia_async(deals: list[dict]):
    app_id = os.getenv("ALGOLIA_APP_ID")
    admin_key = os.getenv("ALGOLIA_ADMIN_KEY")
    if not app_id or not admin_key:
        logging.error("Algolia credentials not set.")
        return

    index_name = os.getenv("ALGOLIA_INDEX_NAME", "Shadow_Merchant")
    records = [deal_to_record(d) for d in deals]

    try:
        async with SearchClient(app_id, admin_key) as client:
            await client.save_objects(index_name=index_name, objects=records)
            logging.info(f"Pushed {len(records)} deals to Algolia.")
    except Exception as e:
        logging.error(f"Failed to push deals to Algolia: {e}")

def push_deals_to_algolia(deals: list[dict]):
    """Synchronously pushes a list of deal dicts to Algolia."""
    if not deals:
        return
    
    try:
        # Check if there is a running loop
        loop = asyncio.get_running_loop()
        # If there is, create a task
        loop.create_task(_push_to_algolia_async(deals))
    except RuntimeError:
        # No running loop, run until complete
        asyncio.run(_push_to_algolia_async(deals))
