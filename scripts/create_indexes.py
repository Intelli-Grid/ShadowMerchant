"""
Run this once to add compound indexes that significantly speed up
category pages, trending feed, and the deals API.

Usage:
    python create_indexes.py
"""
import os
import pymongo
from dotenv import load_dotenv

load_dotenv()


def create_indexes():
    client = pymongo.MongoClient(os.getenv("MONGO_URI"))
    db = client.shadowmerchant
    col = db.deals

    indexes = [
        # Trending / homepage
        ([("is_active", 1), ("is_trending", 1), ("deal_score", -1)],  "idx_active_trending_score"),
        # Category pages
        ([("is_active", 1), ("category", 1), ("deal_score", -1)],     "idx_active_category_score"),
        # Store pages (platform filter)
        ([("is_active", 1), ("source_platform", 1), ("deal_score", -1)], "idx_active_platform_score"),
        # New-today feed
        ([("is_active", 1), ("created_at", -1)],                       "idx_active_created"),
        # Pro-exclusive feed
        ([("is_active", 1), ("is_pro_exclusive", 1), ("deal_score", -1)], "idx_pro_exclusive"),
        # Click tracking / analytics
        ([("click_count", -1)],                                         "idx_click_count"),
    ]

    for fields, name in indexes:
        try:
            col.create_index(fields, name=name, background=True)
            print(f"  ✅ Created: {name}")
        except Exception as e:
            print(f"  ⚠️  {name}: {e}")

    client.close()
    print("\nAll indexes ensured.")


if __name__ == "__main__":
    create_indexes()
