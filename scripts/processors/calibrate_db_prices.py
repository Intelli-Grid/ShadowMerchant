"""
ShadowMerchant — MongoDB Price Recalibration & Corrupted MRP Cleaner
======================================================================
Scans all active deals in MongoDB, detects corrupted MRP values created prior
to the regex parser patch, recalculates realistic reference MRPs, and re-scores
deals to eliminate fake 99% off discounts.
"""

import os
import sys
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from utils.db import get_db
    from processors.deal_scorer import score_deal
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

def calibrate_database():
    try:
        db = get_db()
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return

    deals = list(db.deals.find({"is_active": True}))
    print(f"Found {len(deals)} active deals in MongoDB to audit and calibrate.\n")

    recalibrated_count = 0

    for d in deals:
        deal_id = d["_id"]
        title = d.get("title", "")
        cur_price = d.get("discounted_price") or d.get("current_price", 0)
        orig_price = d.get("original_price", cur_price)
        disc_pct = d.get("discount_percent", 0)

        needs_fix = False
        new_orig_price = orig_price

        # Check for corrupted unit-string MRPs (e.g. 199,000 for 1,990 price item or 42,000 for 449 price item)
        if cur_price > 0 and orig_price >= 100000 and cur_price < 20000:
            needs_fix = True
            # Estimate realistic MRP based on category average ~30% discount
            new_orig_price = round(cur_price * 1.45)
        elif cur_price > 0 and orig_price >= 40000 and cur_price < 1000:
            needs_fix = True
            new_orig_price = round(cur_price * 2.5)
        elif cur_price > 0 and (orig_price / cur_price) > 5.0:
            needs_fix = True
            # Suspect >80% discount multiplier
            new_orig_price = round(cur_price * 1.5)

        if needs_fix or disc_pct > 85:
            if new_orig_price <= cur_price:
                new_orig_price = round(cur_price * 1.2)

            new_disc_pct = min(85, round(((new_orig_price - cur_price) / new_orig_price) * 100))
            
            # Recalculate Shadow Score
            d["discounted_price"] = cur_price
            d["original_price"] = new_orig_price
            d["discount_percent"] = new_disc_pct
            
            new_score = score_deal(d)

            db.deals.update_one(
                {"_id": deal_id},
                {
                    "$set": {
                        "original_price": new_orig_price,
                        "discount_percent": new_disc_pct,
                        "deal_score": new_score,
                        "recalibrated_at": os.getenv("TIMESTAMP", "2026-08-17")
                    }
                }
            )
            recalibrated_count += 1
            print(f"  [FIXED] {title[:35]}...: MRP RS {orig_price:,.0f} -> RS {new_orig_price:,.0f} (Disc: {new_disc_pct}%, Score: {new_score})")

    print(f"\n[OK] Recalibration complete! Successfully cleaned {recalibrated_count} corrupted deal records in MongoDB.")

if __name__ == "__main__":
    calibrate_database()
