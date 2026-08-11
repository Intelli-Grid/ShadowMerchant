"""
backfill_deal_slugs.py
======================
One-time script to generate SEO slugs for all existing deals that have none.

Run ONCE from the project root:
    cd E:\workspace\projects\tier-0-revenue\shadow-merchant
    python scripts/backfill_deal_slugs.py

What it does:
1. Connects to MongoDB via MONGODB_URI from scripts/.env
2. Fetches all active deals with no slug
3. Generates a unique slug for each
4. Bulk-updates MongoDB
5. Prints a summary

Safe to re-run: skips deals that already have a slug.
"""

import os
import sys
from pathlib import Path

# ── Load env from scripts/.env ─────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip())

MONGODB_URI = os.environ.get("MONGODB_URI")
if not MONGODB_URI:
    print("ERROR: MONGODB_URI not set in scripts/.env")
    sys.exit(1)

try:
    from pymongo import MongoClient, UpdateOne
except ImportError:
    print("ERROR: pymongo not installed. Run: pip install pymongo")
    sys.exit(1)

# Import slug generator
sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.utils.slug_generator import make_deal_slug, make_unique_slug


def main():
    client = MongoClient(MONGODB_URI)
    db = client.get_default_database()
    col = db["deals"]

    print("Connecting to MongoDB...")

    # Fetch all deals with no slug
    deals_without_slug = list(col.find(
        {"slug": {"$exists": False}, "is_active": True},
        {"_id": 1, "title": 1, "discount_percent": 1, "source_platform": 1}
    ))

    total = len(deals_without_slug)
    print(f"Found {total} active deals without slugs.")

    if total == 0:
        print("Nothing to backfill. All deals already have slugs.")
        return

    # Pre-load existing slugs to ensure uniqueness
    existing_slugs = set(
        d["slug"] for d in col.find({"slug": {"$exists": True}}, {"slug": 1})
        if d.get("slug")
    )
    print(f"Pre-loaded {len(existing_slugs)} existing slugs.")

    ops = []
    generated = 0
    skipped = 0

    for deal in deals_without_slug:
        try:
            title = deal.get("title", "")
            discount = deal.get("discount_percent", 0) or 0
            platform = deal.get("source_platform", "store")

            if not title:
                skipped += 1
                continue

            base_slug = make_deal_slug(title, discount, platform)
            unique_slug = make_unique_slug(base_slug, existing_slugs)
            existing_slugs.add(unique_slug)

            ops.append(UpdateOne(
                {"_id": deal["_id"]},
                {"$set": {"slug": unique_slug}}
            ))
            generated += 1

            if generated % 100 == 0:
                print(f"  Processed {generated}/{total}...")

        except Exception as e:
            print(f"  WARN: Failed to generate slug for deal {deal['_id']}: {e}")
            skipped += 1

    if ops:
        print(f"Writing {len(ops)} slugs to MongoDB...")
        result = col.bulk_write(ops, ordered=False)
        print(f"Updated: {result.modified_count} | Matched: {result.matched_count}")

    print(f"\nDone. Generated: {generated} | Skipped: {skipped}")
    print("New deals will get slugs automatically from deal_processor.py going forward.")
    client.close()


if __name__ == "__main__":
    main()
