"""
ShadowMerchant — Social Distribution Content Generator
======================================================
Automates the creation of ready-to-publish Telegram broadcasts, 
WhatsApp channel cards, and 30s Short-Form Video scripts for high-confidence 
laptop decision reports.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DATA_PATH = Path(__file__).parent.parent.parent / "apps" / "web" / "src" / "data" / "laptop_reports_data.json"
OUTPUT_DIR = Path(__file__).parent / "output"

def format_price(price: int) -> str:
    return f"₹{price:,.0f}"

def generate_social_content():
    if not DATA_PATH.exists():
        print(f"Error: Data file not found at {DATA_PATH}")
        return

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        laptops = json.load(f)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    telegram_queue = []
    social_payloads = []

    for lap in laptops:
        title = lap["title"]
        platform = lap["platform"]
        cur = lap["current_price"]
        orig = lap["original_price"]
        med = lap["observed_median"]
        rec = lap["recommendation"]
        reason = lap["reasoning"]
        slug = lap["slug"]
        url = lap["url"]
        snaps = lap["observation_count"]

        report_link = f"https://www.shadowmerchant.online/reports/laptops/{slug}"
        verdict_emoji = "🟢 BUY VERDICT" if rec == "BUY" else "🟡 WAIT VERDICT"

        # 1. Telegram Broadcast Format
        telegram_text = (
            f"💻 *LAPTOP DECISION RECORD #{lap['id']}*\n"
            f"*{title}*\n\n"
            f"{verdict_emoji}\n"
            f"📊 *Current Price:* {format_price(cur)} (MRP: ~{format_price(orig)}~)\n"
            f"📉 *Observed 30-Day Median:* {format_price(med)}\n"
            f"🔍 *Observed Snapshots:* {snaps} records\n\n"
            f"💡 *Analysis:* {reason}\n\n"
            f"🔗 *Full Decision Report:* {report_link}\n"
            f"🛒 *Store Direct:* [Check on {platform}]({url})\n\n"
            f"⚠️ _Product prices accurate as of {datetime.utcnow().strftime('%d %b %Y')}. We earn affiliate commissions on store links._"
        )

        # 2. WhatsApp Channel Format
        whatsapp_text = (
            f"💻 *{title}*\n\n"
            f"Status: *{rec}*\n"
            f"💰 Price: {format_price(cur)} | 30-Day Median: {format_price(med)}\n\n"
            f"Read Full Audit: {report_link}\n"
            f"Buy on {platform}: {url}\n\n"
            f"_(Affiliate Disclosure: Earns commission)_"
        )

        # 3. 30-Second Shorts/Reels Video Script
        video_script = {
            "hook_0_5s": f"Don't buy the {title[:30]}... until you see its real 30-day price graph!",
            "evidence_5_15s": f"Amazon lists the MRP at {format_price(orig)}, but our tracking engine shows the real 30-day median is actually {format_price(med)}.",
            "verdict_15_25s": f"Today's price of {format_price(cur)} is {rec}. {reason}",
            "cta_25_30s": f"Read the full SKU decision report on ShadowMerchant.online/reports/laptops!",
            "visual_instructions": f"Screen-record price history graph on ShadowMerchant website while scrolling through report #{lap['id']}."
        }

        telegram_queue.append(telegram_text)
        social_payloads.append({
            "id": lap["id"],
            "slug": slug,
            "title": title,
            "telegram_post": telegram_text,
            "whatsapp_post": whatsapp_text,
            "video_script": video_script,
        })

    # Save outputs
    json_out = OUTPUT_DIR / "ready_posts.json"
    json_out.write_text(json.dumps(social_payloads, indent=2), encoding="utf-8")

    md_out = OUTPUT_DIR / "telegram_channel_queue.md"
    md_content = f"# ShadowMerchant — Ready Telegram Channel Queue ({datetime.utcnow().strftime('%Y-%m-%d')})\n\n"
    md_content += "\n\n---\n\n".join(telegram_queue)
    md_out.write_text(md_content, encoding="utf-8")

    print(f"✅ Generated {len(laptops)} ready social post payloads in:")
    print(f"   - JSON Payload: {json_out}")
    print(f"   - Telegram Queue: {md_out}")

if __name__ == "__main__":
    generate_social_content()
