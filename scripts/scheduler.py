"""
ShadowMerchant — Daily Deal Refresh Scheduler
=============================================
Runs the full scraper pipeline automatically on a schedule.

Usage:
    # Run once immediately (for testing):
    .venv\Scripts\python.exe scripts\scheduler.py --run-now

    # Start the 24/7 scheduler daemon:
    .venv\Scripts\python.exe scripts\scheduler.py

Schedule (IST):
    - 06:00  Morning run  (daily deals, fresh inventory)
    - 13:00  Afternoon run (flash sales, lunchtime deals)
    - 21:00  Night run    (end-of-day clearance deals)

The scheduler also exposes a health-check endpoint on port 8765
so Vercel/external monitors can ping it.
"""
import sys
import os
import logging
import argparse
import time
from pathlib import Path
from datetime import datetime

# ── Path Setup ──────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
os.chdir(Path(__file__).parent)

from dotenv import load_dotenv
load_dotenv()

# ── Logging ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.FileHandler("scheduler.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
logger = logging.getLogger("scheduler")

# ── Active Scrapers (confirmed working) ─────────────────────────
SCRAPER_PRIORITY = [
    "meesho",   # API-based, 719 deals/run confirmed
    "amazon",   # Stealth Playwright, 235 deals/run confirmed
]


def run_pipeline(scrapers: list[str] | None = None) -> dict:
    """Run the scraper pipeline and return stats."""
    import importlib
    import pymongo
    from processors.deal_scorer import score_deal_with_breakdown
    from processors.deduplicator import deduplicate_deals

    to_run = scrapers or SCRAPER_PRIORITY
    logger.info(f"[START] Pipeline triggered - scrapers: {to_run}")
    start = datetime.utcnow()

    SCRAPER_MAP = {
        "amazon":   ("scrapers.amazon_scraper",   "AmazonScraper"),
        "flipkart": ("scrapers.flipkart_scraper", "FlipkartScraper"),
        "myntra":   ("scrapers.myntra_scraper",   "MyntraScraper"),
        "meesho":   ("scrapers.meesho_scraper",   "MeeshoScraper"),
        "nykaa":    ("scrapers.nykaa_scraper",    "NykaaScraper"),
        "croma":    ("scrapers.croma_scraper",    "CromaScraper"),
    }

    all_deals = []
    scraper_stats = {}

    for name in to_run:
        if name not in SCRAPER_MAP:
            continue
        module_path, class_name = SCRAPER_MAP[name]
        try:
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name)
            scraper = cls()
            deals = scraper.scrape_deals()
            all_deals.extend(deals)
            scraper_stats[name] = len(deals)
            logger.info(f"  [OK] {name}: {len(deals)} deals")
        except Exception as e:
            logger.error(f"  [FAIL] {name}: {e}")
            scraper_stats[name] = 0
            try:
                import asyncio
                from social.telegram_poster import send_admin_alert
                asyncio.run(send_admin_alert(f"⚠️ {name} returned 0 deals: {str(e)[:150]}"))
            except Exception:
                pass

    logger.info(f"[DATA] Total collected: {len(all_deals)}")

    # De-duplicate
    deduped = deduplicate_deals(all_deals)
    logger.info(f"[DATA] After dedup: {len(deduped)} unique deals")

    # ── Save to MongoDB ──────────────────────────────────────────
    saved = 0
    try:
        client = pymongo.MongoClient(
            os.getenv("MONGO_URI") or os.getenv("MONGODB_URI"),
            serverSelectionTimeoutMS=10000
        )
        db = client.shadowmerchant

        # Mark all existing deals as stale before refresh
        db.deals.update_many({}, {"$set": {"is_stale": True}})

        for deal in deduped:
            try:
                deal_score, score_breakdown = score_deal_with_breakdown(deal)

                def _f(field, default=""):
                    return getattr(deal, field, default) if not isinstance(deal, dict) else deal.get(field, default)

                title       = str(_f("title", "")).strip()
                platform    = str(_f("platform", "unknown"))
                orig_price  = float(_f("original_price", 0) or 0)
                disc_price  = float(_f("discounted_price", 0) or 0)
                product_url = str(_f("product_url", "") or "").strip()
                image_url   = str(_f("image_url", "") or "").strip()
                category    = str(_f("category", "other") or "other")
                disc_pct    = int(round((1 - disc_price / orig_price) * 100)) if orig_price > disc_price > 0 else 0

                if not title or disc_price <= 0 or not product_url:
                    continue

                doc = {
                    "title":            title,
                    "source_platform":  platform,
                    "original_price":   orig_price,
                    "discounted_price": disc_price,
                    "discount_percent": disc_pct,
                    "deal_score":       int(deal_score),
                    "score_breakdown":  score_breakdown,
                    "affiliate_url":    product_url,
                    "image_url":        image_url,
                    "category":         category,
                    "brand":            str(_f("brand", "") or ""),
                    "rating":           float(_f("rating", 0) or 0),
                    "rating_count":     int(_f("rating_count", 0) or 0),
                    "is_active":        True,
                    "is_stale":         False,
                    # Pro gating discontinued: all deals are free to view
                    "is_pro_exclusive": False,
                    "scraped_at":       datetime.utcnow(),
                    "updated_at":       datetime.utcnow(),
                }

                result = db.deals.update_one(
                    {"affiliate_url": product_url},
                    {
                        "$set": doc,
                        "$push": {
                            "price_history": {
                                "$each": [{"date": datetime.utcnow(), "price": disc_price}],
                                "$slice": -30,
                            }
                        },
                        "$setOnInsert": {
                            "created_at": datetime.utcnow(),
                            "deal_id": str(__import__("uuid").uuid4()),
                        }
                    },
                    upsert=True,
                )
                if result.upserted_id or result.modified_count:
                    saved += 1

            except Exception as e:
                logger.debug(f"Deal save error: {e}")

        # Deactivate stale deals
        stale_result = db.deals.update_many(
            {"is_stale": True},
            {"$set": {"is_active": False}}
        )
        logger.info(f"Deactivated {stale_result.modified_count} stale deals")

        # Tag top 10 deals as is_trending
        try:
            db.deals.update_many({}, {"$set": {"is_trending": False}})
            top_ids = [
                d["_id"] for d in db.deals.find(
                    {"is_active": True},
                    {"_id": 1}
                ).sort("deal_score", -1).limit(10)
            ]
            if top_ids:
                db.deals.update_many(
                    {"_id": {"$in": top_ids}},
                    {"$set": {"is_trending": True}}
                )
                logger.info(f"Tagged {len(top_ids)} trending deals")
        except Exception as e:
            logger.error(f"Trending tag error: {e}")

        try:
            elapsed_current = (datetime.utcnow() - start).seconds
            db.scrapelogs.insert_one({
                "run_at": start, "completed_at": datetime.utcnow(),
                "elapsed_seconds": elapsed_current, "scrapers": scraper_stats,
                "total_collected": len(all_deals), "saved": saved, "status": "success",
            })
        except Exception as e:
            logger.error(f"[LOG] ScrapeLog write failed: {e}")

        try:
            import subprocess
            subprocess.run([sys.executable, "index_algolia.py"],
                cwd=str(Path(__file__).parent), capture_output=True, timeout=120)
            logger.info("[ALGOLIA] Sync complete")
        except Exception as e:
            logger.error(f"[ALGOLIA] {e}")
        
        try:
            import asyncio
            from social.telegram_poster import post_to_telegram
            asyncio.run(post_to_telegram())
            logger.info("[TELEGRAM] Posted")
        except Exception as e:
            logger.error(f"[TELEGRAM] {e}")

        try:
            import asyncio
            from trigger_alerts import dispatch_alerts
            asyncio.run(dispatch_alerts(start))
        except Exception as e:
            logger.error(f"[ALERTS] {e}")

        client.close()

    except Exception as e:
        logger.error(f"MongoDB error: {e}")

    elapsed = (datetime.utcnow() - start).seconds
    logger.info(f"[DONE] Pipeline complete - {saved} deals saved in {elapsed}s")

    return {
        "scrapers": scraper_stats,
        "total_collected": len(all_deals),
        "total_deduped": len(deduped),
        "saved": saved,
        "elapsed_seconds": elapsed,
        "run_at": datetime.utcnow().isoformat(),
    }


def start_scheduler():
    """Start the scheduled pipeline with 3 daily runs."""
    try:
        import schedule
    except ImportError:
        logger.error("'schedule' package not installed. Run: pip install schedule")
        sys.exit(1)

    logger.info("⏰ ShadowMerchant Scheduler starting...")
    logger.info("   Run times (IST): 06:00, 13:00, 21:00")

    def job():
        logger.info("🔔 Scheduled pipeline triggered")
        try:
            run_pipeline()
        except Exception as e:
            logger.error(f"Scheduled pipeline failed: {e}")

    def email_job():
        try:
            from notifiers.email_notifier import send_digest
            send_digest()
        except Exception as e:
            logger.error(f"Email digest: {e}")

    schedule.every().day.at("01:00").do(job)   # 06:30 IST
    schedule.every().day.at("15:00").do(job)   # 20:30 IST
    schedule.every().day.at("04:00").do(email_job)  # 09:30 IST

    logger.info("Scheduler loop initialized.")
    while True:
        schedule.run_pending()
        time.sleep(30)


def start_web_server():
    """Start a lightweight web server to satisfy Cloud Platform health checks (Render, Railway)."""
    try:
        from flask import Flask, jsonify
    except ImportError:
        logger.warning("Flask not installed. Health-check endpoint will not start. (pip install Flask)")
        return

    app = Flask(__name__)

    @app.route('/')
    def health_check():
        return jsonify({
            "status": "online",
            "service": "ShadowMerchant Intelligence Scraper",
            "timestamp": datetime.utcnow().isoformat()
        })

    port = int(os.environ.get("PORT", 8765))
    logger.info(f"🌐 Starting Health-Check server on port {port}...")
    app.run(host="0.0.0.0", port=port, use_reloader=False)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ShadowMerchant Deal Scheduler")
    parser.add_argument(
        "--run-now",
        action="store_true",
        help="Run the pipeline immediately (useful for testing/manual refresh)"
    )
    parser.add_argument(
        "--scrapers",
        nargs="+",
        choices=["amazon", "flipkart", "myntra", "meesho", "nykaa", "croma"],
        help="Limit to specific scrapers (default: all)"
    )
    args = parser.parse_args()

    if args.run_now:
        logger.info("▶ Manual run triggered")
        stats = run_pipeline(args.scrapers)
        print(f"\nRun complete: {stats['saved']} deals saved in {stats['elapsed_seconds']}s")
    else:
        # Run the scheduler in a background thread
        import threading
        scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
        scheduler_thread.start()

        # Run the Flask web server on the main thread
        start_web_server()
