"""
ShadowMerchant — Daily Deal Refresh Scheduler
=============================================
Runs the full scraper pipeline automatically on a schedule.

Usage:
    # Run once immediately (for testing):
    python scripts/scheduler.py --run-now

    # Start the 24/7 scheduler daemon:
    python scripts/scheduler.py

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
        logging.StreamHandler(sys.stdout),
    ],
)
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
logger = logging.getLogger("scheduler")

# ── Active Scrapers ─────────────────────────────────────────────
SCRAPER_PRIORITY = [
    "meesho",    # Pure httpx API — 720 deals/run confirmed
    "amazon",    # Playwright stealth — works on GitHub Actions (Linux)
    "flipkart",  # Pure httpx — session-bootstrap removed
    "myntra",    # Pure httpx — gateway API direct
    "nykaa",     # Pure httpx — search API direct
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
                from social.telegram_poster import post_admin_alert
                asyncio.run(post_admin_alert(f"⚠️ {name} scraper failed: {str(e)[:150]}"))
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

        # SAFETY: Platform-scoped stale management
        platforms_with_new_deals = list(set(
            d.get("platform") or d.get("source_platform") 
            for d in deduped 
            if d.get("platform") or d.get("source_platform")
        ))
        logger.info(f"[STALE] Scoping stale flag to platforms: {platforms_with_new_deals}")

        if platforms_with_new_deals:
            db.deals.update_many(
                {"source_platform": {"$in": platforms_with_new_deals}},
                {"$set": {"is_stale": True}}
            )
        else:
            logger.warning("Skipping stale-mark: 0 deals collected, keeping existing deals active.")

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

                if not title or disc_price <= 0 or not product_url or orig_price <= 0:
                    continue
                    
                calculated_discount = int(round((1 - disc_price / orig_price) * 100)) if orig_price > disc_price else 0
                if calculated_discount < 10:
                    continue
                
                if disc_price < 200:
                    continue
                    
                if platform == "meesho" and orig_price > disc_price * 4:
                    orig_price = disc_price * (1 / 0.30)
                    disc_pct = 70

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

        # Deactivate stale deals — ONLY if we successfully saved new deals
        active_platforms = db.deals.distinct(
            "source_platform", 
            {"is_active": True, "is_stale": {"$ne": True}}
        )
        platforms_after_deactivation = set(active_platforms + platforms_with_new_deals)

        if len(platforms_after_deactivation) >= 2 or saved >= 50:
            stale_result = db.deals.update_many(
                {"is_stale": True, "source_platform": {"$in": platforms_with_new_deals}},
                {"$set": {"is_active": False}}
            )
            logger.info(f"[STALE] Deactivated {stale_result.modified_count} stale deals from {platforms_with_new_deals}")
        else:
            db.deals.update_many({"is_stale": True}, {"$set": {"is_stale": False}})
            logger.warning(f"[SAFETY] Rolled back stale flag — deactivation would leave < 2 platforms")

        # ── Professional Trending Selection ─────────────────────────
        # Composite score: absolute savings (30%) + discount% (20%) +
        # price tier (20%) + deal_score (20%) + social proof (5%) + freshness (5%)
        # Hard rules: original_price >= ₹500, discount >= 20%, max 3 per platform
        try:
            import math
            now_utc = datetime.utcnow()

            # Fetch all qualifying candidates — price floor + discount floor
            candidates = list(db.deals.find(
                {
                    "is_active": True,
                    "original_price":   {"$gte": 500},
                    "discount_percent": {"$gte": 20},
                },
                {
                    "_id": 1, "original_price": 1, "discounted_price": 1,
                    "discount_percent": 1, "deal_score": 1,
                    "rating": 1, "rating_count": 1,
                    "scraped_at": 1, "source_platform": 1,
                }
            ))

            def _trending_score(d: dict) -> float:
                orig   = float(d.get("original_price", 0) or 0)
                disc   = float(d.get("discounted_price", 0) or 0)
                pct    = float(d.get("discount_percent", 0) or 0)
                ai     = float(d.get("deal_score", 0) or 0)
                rating = float(d.get("rating", 0) or 0)
                rcount = int(d.get("rating_count", 0) or 0)
                s_at   = d.get("scraped_at", now_utc)

                # 1. Absolute savings (₹) — normalized, cap at ₹10,000
                savings_score = min((orig - disc) / 100.0, 100.0)

                # 2. Discount % — direct, cap at 100
                discount_score = min(pct, 100.0)

                # 3. Price tier — higher-ticket items deserve showcase placement
                if orig >= 15000:   price_tier = 100.0
                elif orig >= 5000:  price_tier = 75.0
                elif orig >= 2000:  price_tier = 50.0
                elif orig >= 1000:  price_tier = 35.0
                else:               price_tier = 15.0

                # 4. AI deal score — existing quality signal (already 0-100)
                ai_score = ai

                # 5. Social proof: rating x log10(reviews+1) x 20, cap at 100
                social = min((rating / 5.0) * math.log10(rcount + 1) * 20, 100.0)

                # 6. Freshness decay — full score now, zero after 12 hours
                if isinstance(s_at, datetime):
                    hours_old = (now_utc - s_at).total_seconds() / 3600
                else:
                    hours_old = 0
                freshness = max(0.0, 100.0 - (hours_old / 36.0 * 100.0))

                return (
                    savings_score  * 0.30 +
                    discount_score * 0.20 +
                    price_tier     * 0.20 +
                    ai_score       * 0.20 +
                    social         * 0.05 +
                    freshness      * 0.05
                )

            # Sort all candidates by composite score
            scored = sorted(
                [{"deal": d, "score": _trending_score(d)} for d in candidates],
                key=lambda x: x["score"],
                reverse=True
            )

            # Greedy selection — platform diversity cap: max 3 per platform
            selected = []
            platform_count: dict = {}
            platform_buckets: dict = {}

            for item in scored:
                platform = item["deal"].get("source_platform", "unknown")
                platform_buckets.setdefault(platform, []).append(item)

            rounds = (10 // max(len(platform_buckets), 1)) + 1
            for round_num in range(rounds):
                for platform, bucket in platform_buckets.items():
                    if len(selected) >= 10:
                        break
                    if platform_count.get(platform, 0) >= 3:
                        continue
                    platform_idx = platform_count.get(platform, 0)
                    if platform_idx < len(bucket):
                        selected.append(bucket[platform_idx])
                        platform_count[platform] = platform_idx + 1
                if len(selected) >= 10:
                    break

            # Reset all flags, then tag selected with score
            db.deals.update_many({}, {"$set": {"is_trending": False, "trending_score": 0}})
            for item in selected:
                db.deals.update_one(
                    {"_id": item["deal"]["_id"]},
                    {"$set": {"is_trending": True, "trending_score": round(item["score"], 2)}}
                )

            top_score = f"{selected[0]['score']:.1f}" if selected else "n/a"
            logger.info(f"[TRENDING] Tagged {len(selected)} deals (platforms: {dict(platform_count)}, top score: {top_score})")
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
    schedule.every().day.at("01:30").do(lambda: asyncio.run(
        __import__('social.telegram_poster', fromlist=['broadcast_deal_of_day']).broadcast_deal_of_day()
    ))


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

    @app.route('/diagnose')
    def diagnose():
        """Live diagnostic — tests both ScraperAPI render mode and proxy+API mode."""
        import requests as req
        key = os.getenv("SCRAPERAPI_KEY", "")
        result = {
            "scraperapi_key_set":     bool(key),
            "scraperapi_key_preview": f"{key[:8]}..." if key else "MISSING",
            "render_mode":            {},
            "proxy_api_mode":         {},
        }

        if not key:
            return jsonify(result)

        # ── Test 1: Render mode (we expect this to fail with 500) ──────────
        try:
            r = req.get(
                "https://api.scraperapi.com",
                params={"api_key": key, "url": "https://www.meesho.com/search?q=electronics", "render": "true", "country_code": "in"},
                timeout=60,
            )
            result["render_mode"] = {"status": r.status_code, "body_length": len(r.text), "has_products": "/p/" in r.text}
        except Exception as e:
            result["render_mode"] = {"error": str(e)}

        # ── Test 2: Proxy + JSON API mode (our new approach) ───────────────
        try:
            proxies = {"http": "http://proxy-server.scraperapi.com:8001", "https": "http://proxy-server.scraperapi.com:8001"}
            payload = {"query": "electronics", "type": "text_search", "page": 1, "offset": 0, "limit": 5, "cursor": None, "isDevicePhone": False}
            headers = {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
                "origin": "https://www.meesho.com",
                "referer": "https://www.meesho.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            }
            r2 = req.post(
                "https://www.meesho.com/api/v1/products/search",
                json=payload, headers=headers,
                proxies=proxies,
                auth=("scraperapi", key),
                timeout=30, verify=False,
            )
            data = {}
            try:
                data = r2.json()
            except Exception:
                pass
            catalogs = data.get("catalogs", [])
            result["proxy_api_mode"] = {
                "status":         r2.status_code,
                "body_length":    len(r2.text),
                "catalogs_found": len(catalogs),
                "first_item":     catalogs[0].get("hero_product_name", "?") if catalogs else None,
            }
        except Exception as e:
            result["proxy_api_mode"] = {"error": str(e)}

        return jsonify(result)


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
        import threading

        # Thread 1 — Scheduler (runs pipeline on schedule)
        scheduler_thread = threading.Thread(target=start_scheduler, daemon=True, name="scheduler")
        scheduler_thread.start()
        logger.info("✅ Scheduler thread started")

        # Thread 2 — Telegram Bot daemon (responds to /run, /status etc.)
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        if bot_token:
            def _start_bot():
                import asyncio as _asyncio
                # python-telegram-bot v21 needs an event loop in its thread
                # Python 3.10+ no longer auto-creates loops in non-main threads
                loop = _asyncio.new_event_loop()
                _asyncio.set_event_loop(loop)
                try:
                    from social.telegram_poster import run_interactive_bot
                    logger.info("🤖 Starting Telegram bot daemon...")
                    run_interactive_bot()
                except Exception as e:
                    logger.error(f"Bot daemon crashed: {e}")
                finally:
                    loop.close()

            bot_thread = threading.Thread(target=_start_bot, daemon=True, name="telegram-bot")
            bot_thread.start()
            logger.info("✅ Telegram bot thread started")
        else:
            logger.warning("⚠️  TELEGRAM_BOT_TOKEN not set — bot daemon skipped")

        # Main thread — Flask health-check server (keeps Render container alive)
        start_web_server()

