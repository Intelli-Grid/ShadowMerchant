"""
ShadowMerchant — 50-SKU Manual Audit Generator
==============================================
Extracts 50 active deals from MongoDB and formats a structured 5-point audit checklist.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Ensure scripts directory is in path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from utils.db import get_db
except ImportError:
    print("Error: Could not import get_db from utils.db")
    sys.exit(1)

def generate_audit_checklist():
    try:
        db = get_db()
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        print("Note: Ensure MONGODB_URI is set in scripts/.env or environment.")
        return

    deals = list(db.deals.find({"is_active": True}).sort("deal_score", -1).limit(50))

    if not deals:
        print("No active deals found in database. Please run python scripts/scheduler.py first.")
        return

    print(f"Loaded {len(deals)} active deals for audit.\n")

    report_lines = []
    report_lines.append("# ShadowMerchant — 50-SKU Manual Audit Checklist")
    report_lines.append(f"Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n")
    report_lines.append("## Instructions for Auditor:")
    report_lines.append("For each SKU below, open the store link and verify against live product page:")
    report_lines.append("1. **Exact Variant:** Is RAM, Storage, Model, Color exact?")
    report_lines.append("2. **Price Match:** Does live store price match `Observed Price`?")
    report_lines.append("3. **MRP Match:** Is reference MRP accurate and not fabricated?")
    report_lines.append("4. **Availability:** Is item in stock and purchasable?")
    report_lines.append("5. **Seller:** Is seller reputable / official brand store?\n")
    report_lines.append("---")

    for i, deal in enumerate(deals, 1):
        title = deal.get("title", "Untitled")
        platform = deal.get("source_platform", "Unknown").title()
        cur_price = deal.get("discounted_price") or deal.get("current_price", 0)
        orig_price = deal.get("original_price", 0)
        obs_count = deal.get("observation_count", 1)
        url = deal.get("product_url") or deal.get("affiliate_url", "")
        seller = deal.get("seller_name", "Unspecified")

        report_lines.append(f"### {i}. [{platform}] {title[:65]}...")
        report_lines.append(f"- **URL:** [Store Product Link]({url})")
        report_lines.append(f"- **Observed Price:** ₹{cur_price:,.0f} | **Strikethrough MRP:** ₹{orig_price:,.0f}")
        report_lines.append(f"- **Tracked Snapshots:** {obs_count} | **Seller:** {seller}")
        report_lines.append("- **Verification Checks:**")
        report_lines.append("  - [ ] Exact Variant Match")
        report_lines.append("  - [ ] Live Price Match (within ₹50)")
        report_lines.append("  - [ ] MRP Match")
        report_lines.append("  - [ ] In Stock")
        report_lines.append("  - [ ] Reputable Seller\n")

    output_path = Path(__file__).parent / "SKU_AUDIT_CHECKLIST.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

    print(f"Audit checklist successfully generated at: {output_path}")

if __name__ == "__main__":
    generate_audit_checklist()
