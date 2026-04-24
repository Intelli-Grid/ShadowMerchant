import os
import sys
from pathlib import Path

# Add the scripts directory to the path
current_dir = Path(__file__).resolve().parent
scripts_dir = current_dir.parent
sys.path.append(str(scripts_dir))

from utils.db import get_db

def cleanup_bad_deals():
    db = get_db()
    if db is None:
        print("Failed to connect to database.")
        return

    deals_collection = db.deals

    # Find deals where discounted_price >= original_price (MRP)
    # Using $expr to compare two fields in the same document
    query = {
        "$expr": {
            "$gte": ["$discounted_price", "$original_price"]
        }
    }

    print("Running bad data cleanup: deleting deals where discounted_price >= original_price")
    result = deals_collection.delete_many(query)
    print(f"Cleanup complete. Deleted {result.deleted_count} bad deals.")

if __name__ == "__main__":
    cleanup_bad_deals()
