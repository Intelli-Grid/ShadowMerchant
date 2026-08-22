import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_db
from processors.deal_scorer import score_deal

db = get_db()
all_active = list(db.deals.find({"is_active": True}))
print(f"Checking {len(all_active)} active deals in MongoDB Atlas...")

repaired = 0
for d in all_active:
    disc_p = float(d.get("discounted_price", 0) or 0)
    orig_p = float(d.get("original_price", 0) or 0)
    disc_pct = float(d.get("discount_percent", 0) or 0)
    
    if disc_p <= 0:
        continue
    
    needs_fix = False
    new_orig = orig_p
    
    # 100x paise DOM artifact (e.g. 266376 vs 2663.76)
    if orig_p > disc_p * 10 and abs(orig_p - disc_p * 100) / (disc_p * 100) < 0.05:
        new_orig = disc_p
        needs_fix = True
    elif orig_p / disc_p > 4 or disc_pct >= 80:
        # Extreme seller MRP (>75% discount) -> clamp to max 33% discount (1.5x of sale price)
        new_orig = disc_p * 1.5
        needs_fix = True

    if needs_fix:
        new_disc_pct = 0
        if new_orig > 0 and disc_p < new_orig:
            new_disc_pct = round((1 - disc_p / new_orig) * 100)
        
        d["original_price"] = new_orig
        d["discounted_price"] = disc_p
        d["discount_percent"] = new_disc_pct
        new_score = score_deal(d)
        
        is_trending = new_score >= 80 and new_disc_pct <= 80

        db.deals.update_one(
            {"_id": d["_id"]},
            {
                "$set": {
                    "original_price": new_orig,
                    "discount_percent": new_disc_pct,
                    "deal_score": new_score,
                    "is_trending": is_trending,
                    "mrp_verified": "shifted" if new_disc_pct > 50 else "verified"
                }
            }
        )
        t = d.get("title", "")[:45]
        print(f"REPAIRED: {t} | Old Orig: RS {orig_p:,.2f} -> New Orig: RS {new_orig:,.2f} | Disc: {disc_pct}% -> {new_disc_pct}% | Score: {new_score}")
        repaired += 1

print(f"\nSuccessfully repaired {repaired} suspect deals in MongoDB Atlas!")
