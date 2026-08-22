"""
ShadowMerchant — Deal Trust Management & Audit Engine
=====================================================
Applies the rebuild trust system to all active deals in MongoDB:
  - Audits price history depth & observation counts
  - Calculates observed min, max, and median prices
  - Evaluates MRP clarity (detects shifted/inflated reference prices)
  - Tags deals with auditable evidence labels & trust levels
  - Flags potential data issues or low-confidence listings

Usage:
    python scripts/manage_deal_trust.py
"""
import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Windows UTF-8 fix for terminal printing
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from utils.db import get_db
from processors.deal_scorer import check_mrp_clarity

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("trust_manager")


def audit_and_manage_deals():
    try:
        db = get_db()
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        return None

    active_deals = list(db.deals.find({"is_active": True}))
    logger.info(f"🔍 Starting Trust Audit for {len(active_deals)} active deals...")

    stats = {
        "total_active": len(active_deals),
        "trust_levels": {
            "30_day_history": 0,
            "tracked_history": 0,
            "new_tracking": 0,
        },
        "mrp_verdicts": {
            "verified": 0,
            "shifted": 0,
            "unknown": 0,
        },
        "price_positions": {
            "near_observed_low": 0,
            "below_median": 0,
            "regular": 0,
        },
        "stale_flagged": 0,
        "pro_exclusive": 0,
        "platform_counts": {},
        "top_trusted_deals": [],
        "shifted_mrp_deals": [],
    }

    updated_count = 0

    for deal in active_deals:
        deal_id = deal["_id"]
        title = deal.get("title", "Untitled")
        platform = deal.get("source_platform", "unknown")
        orig_price = float(deal.get("original_price", 0) or 0)
        disc_price = float(deal.get("discounted_price", 0) or 0)
        history = deal.get("price_history", [])
        is_stale = deal.get("data_may_be_stale", False) or deal.get("is_stale", False)
        is_pro = deal.get("is_pro_exclusive", False)

        stats["platform_counts"][platform] = stats["platform_counts"].get(platform, 0) + 1

        if is_stale:
            stats["stale_flagged"] += 1
        if is_pro:
            stats["pro_exclusive"] += 1

        # ── 1. Calculate History Metrics ──────────────────────────────────────
        prices = [float(h.get("price", 0)) for h in history if h.get("price")]
        mrps = [float(h.get("mrp", 0)) for h in history if h.get("mrp")]

        valid_dates = set()
        for h in history:
            d = h.get("date")
            if isinstance(d, datetime):
                valid_dates.add(d.strftime("%Y-%m-%d"))

        valid_days_count = len(valid_dates)
        obs_count = len(history)

        if prices:
            prices_sorted = sorted(prices)
            n = len(prices_sorted)
            median_price = prices_sorted[n // 2] if n % 2 != 0 else (prices_sorted[n // 2 - 1] + prices_sorted[n // 2]) / 2.0
            min_price = min(prices_sorted)
            max_price = max(prices_sorted)
        else:
            median_price = disc_price
            min_price = disc_price
            max_price = disc_price

        # ── 2. Assign Trust Level Label ───────────────────────────────────────
        if valid_days_count >= 30:
            trust_level = "30_day_history"
            trust_badge = "30-Day Verified History"
            stats["trust_levels"]["30_day_history"] += 1
        elif valid_days_count >= 7:
            trust_level = "tracked_history"
            trust_badge = f"{valid_days_count}-Day Tracked Record"
            stats["trust_levels"]["tracked_history"] += 1
        else:
            trust_level = "new_tracking"
            trust_badge = "New Record (Building History)"
            stats["trust_levels"]["new_tracking"] += 1

        # ── 3. Evaluate MRP Clarity / Shifted Reference Price ─────────────────
        mrp_assessment = check_mrp_clarity(history, orig_price, disc_price)
        mrp_verdict = mrp_assessment["verdict"]
        mrp_note = mrp_assessment["note"]
        stats["mrp_verdicts"][mrp_verdict] = stats["mrp_verdicts"].get(mrp_verdict, 0) + 1

        if mrp_verdict == "shifted":
            stats["shifted_mrp_deals"].append({
                "title": title[:55],
                "platform": platform,
                "listed_mrp": orig_price,
                "current_price": disc_price,
                "note": mrp_note,
            })

        # ── 4. Evaluate Price Position ────────────────────────────────────────
        if min_price > 0 and disc_price <= min_price * 1.03:
            price_position = "near_observed_low"
            price_badge = "Near Observed 30-Day Low"
            stats["price_positions"]["near_observed_low"] += 1
        elif median_price > 0 and disc_price <= median_price * 0.95:
            price_position = "below_median"
            price_badge = f"{round((1 - disc_price / median_price) * 100)}% Below Observed Median"
            stats["price_positions"]["below_median"] += 1
        else:
            price_position = "regular"
            price_badge = "Standard Observed Price"
            stats["price_positions"]["regular"] += 1

        # ── 5. Update DB with Normalized Trust Attributes ─────────────────────
        update_fields = {
            "trust_level": trust_level,
            "trust_badge": trust_badge,
            "mrp_verified": mrp_verdict,
            "mrp_note": mrp_note,
            "price_position": price_position,
            "price_badge": price_badge,
            "observation_count": obs_count,
            "valid_days_count": valid_days_count,
            "observed_median_price": median_price,
            "observed_min_price": min_price,
            "observed_max_price": max_price,
            "trust_audited_at": datetime.now(timezone.utc),
        }

        db.deals.update_one({"_id": deal_id}, {"$set": update_fields})
        updated_count += 1

        # Track top scored deals
        deal_score = int(deal.get("deal_score", 0) or 0)
        if deal_score >= 60:
            stats["top_trusted_deals"].append({
                "title": title[:60],
                "platform": platform,
                "price": disc_price,
                "orig_price": orig_price,
                "discount_pct": deal.get("discount_percent", 0),
                "deal_score": deal_score,
                "trust_badge": trust_badge,
                "mrp_verdict": mrp_verdict,
            })

    # Sort top trusted deals by deal score descending
    stats["top_trusted_deals"] = sorted(stats["top_trusted_deals"], key=lambda x: x["deal_score"], reverse=True)[:10]

    logger.info(f"✅ Trust audit complete. Updated {updated_count} deals.")
    return stats


def print_report(stats: dict):
    if not stats:
        print("No stats generated.")
        return

    print("\n" + "=" * 65)
    print("      SHADOW MERCHANT — DEAL TRUST & AUDIT REPORT")
    print("=" * 65)
    print(f"Total Active Deals Audited : {stats['total_active']}")
    print(f"Pro Exclusive Deals        : {stats['pro_exclusive']}")
    print(f"Stale-Flagged Deals        : {stats['stale_flagged']}")
    print("-" * 65)

    print("\n📦 Active Deals by Platform:")
    for plat, cnt in stats["platform_counts"].items():
        print(f"  - {plat.upper():<10} : {cnt} deals")

    print("\n🛡️ Trust Level Breakdown:")
    print(f"  - 30-Day Verified History : {stats['trust_levels']['30_day_history']}")
    print(f"  - Tracked History (7-29d) : {stats['trust_levels']['tracked_history']}")
    print(f"  - New Record (<7d)        : {stats['trust_levels']['new_tracking']}")

    print("\n🔍 MRP Reference Price Verification:")
    print(f"  - Verified Genuine        : {stats['mrp_verdicts']['verified']}")
    print(f"  - Shifted / Inflated MRP  : {stats['mrp_verdicts']['shifted']}")
    print(f"  - Unknown / Building      : {stats['mrp_verdicts']['unknown']}")

    print("\n📊 Price Position Signals:")
    print(f"  - Near Observed Low (3%)  : {stats['price_positions']['near_observed_low']}")
    print(f"  - Below Observed Median   : {stats['price_positions']['below_median']}")
    print(f"  - Regular Price           : {stats['price_positions']['regular']}")

    if stats["shifted_mrp_deals"]:
        print(f"\n⚠️ Reference Price Gap / Shifted MRP Deals Flagged ({len(stats['shifted_mrp_deals'])}):")
        for idx, d in enumerate(stats["shifted_mrp_deals"][:5], 1):
            print(f"  {idx}. [{d['platform'].upper()}] {d['title']}")
            print(f"     Listed MRP: ₹{d['listed_mrp']} | Sale: ₹{d['current_price']} ({d['note']})")

    print("\n🌟 Top Trusted High-Score Deals:")
    for idx, d in enumerate(stats["top_trusted_deals"][:5], 1):
        print(f"  {idx}. [{d['platform'].upper()}] {d['title']}")
        print(f"     Price: ₹{d['price']} (was ₹{d['orig_price']}) | {d['discount_pct']}% OFF | Score: {d['deal_score']}")
        print(f"     Trust: {d['trust_badge']} | MRP Status: {d['mrp_verdict'].upper()}")

    print("=" * 65 + "\n")


if __name__ == "__main__":
    stats = audit_and_manage_deals()
    if stats:
        print_report(stats)
