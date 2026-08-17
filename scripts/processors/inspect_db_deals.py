"""
Inspect specific MongoDB deal documents to check why MRPs still show 99% off
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.db import get_db

def inspect():
    db = get_db()
    deals = list(db.deals.find({
        "$or": [
            {"title": {"$regex": "PSS Video Game", "$options": "i"}},
            {"title": {"$regex": "KEXIN 256GB", "$options": "i"}},
            {"title": {"$regex": "Micro TF u3", "$options": "i"}},
            {"title": {"$regex": "Handbook of Dosimetry", "$options": "i"}}
        ]
    }))

    print(f"Found {len(deals)} matching deals in MongoDB:\n")
    for d in deals:
        print(f"ID: {d['_id']}")
        print(f"Title: {d.get('title')[:45]}")
        print(f"Discounted Price: RS {d.get('discounted_price')}")
        print(f"Original Price: RS {d.get('original_price')}")
        print(f"Discount %: {d.get('discount_percent')}%")
        print(f"Is Active: {d.get('is_active')}")
        print(f"Deal Score: {d.get('deal_score')}")
        print("-" * 50)

if __name__ == "__main__":
    inspect()
