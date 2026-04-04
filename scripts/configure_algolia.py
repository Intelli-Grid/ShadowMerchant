"""
Configure Algolia index settings:
- Sets searchable attributes (title, description, brand, category)
- Sets facet attributes (is_active, source_platform, category, is_pro_exclusive)
- Sets ranking formula

Run once after creating the index:
  python scripts/configure_algolia.py
"""
import os
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / '.env')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


async def configure():
    from algoliasearch.search.client import SearchClient

    app_id   = os.getenv("ALGOLIA_APP_ID")
    admin_key = os.getenv("ALGOLIA_ADMIN_KEY")
    index_name = os.getenv("ALGOLIA_INDEX_NAME", "Shadow_Merchant")

    if not app_id or not admin_key:
        logging.error("ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY must be set in scripts/.env")
        return

    async with SearchClient(app_id, admin_key) as client:
        logging.info(f"Configuring index '{index_name}'...")

        await client.set_settings(
            index_name=index_name,
            index_settings={
                # Fields Algolia searches through
                "searchableAttributes": [
                    "title",
                    "description",
                    "brand",
                    "category",
                    "source_platform",
                ],
                # Fields available for filtering (filter: 'is_active:true')
                "attributesForFaceting": [
                    "filterOnly(is_active)",
                    "filterOnly(is_pro_exclusive)",
                    "source_platform",
                    "category",
                ],
                # Custom ranking: boost high deal_score, then most recent
                "customRanking": [
                    "desc(deal_score)",
                    "desc(published_at)",
                ],
                # Only return useful fields to browser
                "attributesToRetrieve": [
                    "_id",
                    "title",
                    "source_platform",
                    "original_price",
                    "discounted_price",
                    "discount_percent",
                    "image_url",
                    "affiliate_url",
                    "deal_score",
                    "category",
                    "brand",
                    "is_pro_exclusive",
                ],
                # Highlight title in search results
                "attributesToHighlight": ["title", "brand"],
            }
        )

        logging.info("Index settings applied successfully.")
        logging.info("Searchable: title, description, brand, category, source_platform")
        logging.info("Facets: is_active, is_pro_exclusive, source_platform, category")
        logging.info("Custom ranking: deal_score DESC, published_at DESC")


if __name__ == "__main__":
    asyncio.run(configure())
