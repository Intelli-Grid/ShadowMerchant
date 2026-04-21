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
import asyncio
from pathlib import Path
from datetime import datetime, timezone

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
# Credit budget (ScraperAPI free tier = 5,000/month):
#   meesho:  12 cat × 2 pages = 24 req/run
#   myntra:  15 queries × 1   = 15 req/run
#   nykaa:   8  queries × 1   =  8 req/run
#   total:   47 req/run × 2 runs/day × 30 days = 2,820/month ✅
#
# Amazon uses Playwright (no ScraperAPI credits).
# Flipkart uses official affiliate API (no credits needed) — enable once
# FLIPKART_AFFILIATE_ID + FLIPKART_AFFILIATE_TOKEN are set in env.
SCRAPER_PRIORITY = [
    "meesho",    # ScraperAPI residential proxy + Meesho JSON API
    "amazon",    # Playwright stealth (Linux/Render compatible)
    "myntra",    # ScraperAPI residential proxy + HTML __myx extraction
    "nykaa",     # ScraperAPI residential proxy + __PRELOADED_STATE__ extraction
    # "flipkart", # Official affiliate feed API — set FLIPKART_AFFILIATE_ID to enable
    # "croma",    # Excluded by user preference
]

# Conditionally add Flipkart if credentials are configured
import os as _os
if _os.getenv("FLIPKART_AFFILIATE_ID") and _os.getenv("FLIPKART_AFFILIATE_TOKEN"):
    SCRAPER_PRIORITY.append("flipkart")

# Baseline deal counts — auto-updated after each successful run.
# Used to detect regressions (scraper was working before, now returns 0).
_BASELINE_COUNTS: dict[str, int] = {
    "meesho": 200,
    "amazon":  40,
    "myntra":  50,
    "nykaa":   20,
}

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
    scraper_times = {}

    for name in to_run:
        if name not in SCRAPER_MAP:
            continue
        module_path, class_name = SCRAPER_MAP[name]
        sc_start = datetime.utcnow()
        try:
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name)
            scraper = cls()
            deals = scraper.scrape_deals()
            all_deals.extend(deals)
            scraper_stats[name] = len(deals)
            sc_elapsed = (datetime.utcnow() - sc_start).seconds
            scraper_times[name] = sc_elapsed
            logger.info(f"  [OK] {name}: {len(deals)} deals in {sc_elapsed}s")

            # ── Dead-scraper alert: was working before, now 0 ───────
            baseline = _BASELINE_COUNTS.get(name, 0)
            if len(deals) == 0 and baseline > 0:
                try:
                    from social.telegram_poster import post_admin_alert
                    asyncio.run(post_admin_alert(
                        f"🔴 *{name.upper()} SCRAPER DEAD*\n"
                        f"Expected ~{baseline} deals, got 0.\n"
                        f"Possible causes: ScraperAPI key invalid/exhausted, "
                        f"{name} blocked datacenter IP, or {name} API changed.\n"
                        f"Action: check ScraperAPI dashboard + GitHub Actions logs."
                    ))
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"  [FAIL] {name}: {e}")
            scraper_stats[name] = 0
            scraper_times[name] = (datetime.utcnow() - sc_start).seconds
            try:
                from social.telegram_poster import post_admin_alert
                asyncio.run(post_admin_alert(f"⚠️ {name} scraper EXCEPTION: {str(e)[:150]}"))
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

            # HIGH-09 fix: Two-phase trending update to prevent 0-trending-deals
            # if the process fails between the reset and the re-tagging step.
            #
            # Phase 1: Tag selected deals as trending (safe to do first)
            new_trending_ids = [item["deal"]["_id"] for item in selected]
            for item in selected:
                db.deals.update_one(
                    {"_id": item["deal"]["_id"]},
                    {"$set": {"is_trending": True, "trending_score": round(item["score"], 2)}}
                )

            # Phase 2: Clear is_trending ONLY for deals NOT in the new selection
            # This means a partial failure between Phase 1 and 2 leaves the new
            # trending deals correctly tagged rather than wiping everything first.
            if new_trending_ids:
                db.deals.update_many(
                    {"_id": {"$nin": new_trending_ids}},
                    {"$set": {"is_trending": False, "trending_score": 0}}
                )

            top_score = f"{selected[0]['score']:.1f}" if selected else "n/a"
            logger.info(f"[TRENDING] Tagged {len(selected)} deals (platforms: {dict(platform_count)}, top score: {top_score})")
        except Exception as e:
            logger.error(f"Trending tag error: {e}")

        try:
            elapsed_current = (datetime.utcnow() - start).seconds
            db.scrapelogs.insert_one({
                "run_at": start, "completed_at": datetime.utcnow(),
                "elapsed_seconds": elapsed_current,
                "scrapers": scraper_stats,
                "scraper_times_seconds": scraper_times,
                "total_collected": len(all_deals), "saved": saved, "status": "success",
            })
        except Exception as e:
            logger.error(f"[LOG] ScrapeLog write failed: {e}")

        # ── Auto-calibrate baselines ──────────────────────────────────
        # If a scraper returns > 0 deals this run, update its baseline so
        # future runs can detect regressions (0 deals after a good run).
        for name, count in scraper_stats.items():
            if count > 0:
                _BASELINE_COUNTS[name] = max(count // 2, 10)  # Use 50% of good run as floor
                logger.info(f"[BASELINE] Updated {name} baseline to {_BASELINE_COUNTS[name]}")

        try:
            import subprocess
            subprocess.run([sys.executable, "index_algolia.py"],
                cwd=str(Path(__file__).parent), capture_output=True, timeout=120)
            logger.info("[ALGOLIA] Sync complete")
        except Exception as e:
            logger.error(f"[ALGOLIA] {e}")
        
        try:
            from social.telegram_poster import broadcast_smart, post_pipeline_report
            asyncio.run(broadcast_smart())
            logger.info("[TELEGRAM] Broadcasted deals")

            # Form stats dictionary for report — include timing breakdown
            stats = {
                "scrapers": scraper_stats,
                "scraper_times": scraper_times,
                "total_collected": len(all_deals),
                "total_deduped": len(deduped),
                "saved": saved,
                "elapsed_seconds": elapsed_current,
                "run_at": start.isoformat(),
            }
            asyncio.run(post_pipeline_report(stats))
            logger.info("[TELEGRAM] Posted pipeline report to admin")
        except Exception as e:
            logger.error(f"[TELEGRAM] {e}")

        try:
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
    
    # ── SOCIAL GROWTH MASTERGUIDE SCHEDULE (IST converted to UTC) ──
    # IST: 07:30, 09:00, 13:00, 16:00, 19:00, 20:30, 22:00
    # UTC: 02:00, 03:30, 07:30, 10:30, 13:30, 15:00, 16:30
    def trigger_broadcast():
        try:
            asyncio.run(__import__('social.telegram_poster', fromlist=['broadcast_smart']).broadcast_smart())
        except Exception as exc:
            logger.error("[Scheduler] Broadcast job failed, scheduler stays alive: %s", exc, exc_info=True)
        
    # 7 daily broadcasts mapped to IST post-type windows:
    #   UTC 01:30 -> IST 07:00  Morning Brief
    #   UTC 04:30 -> IST 10:00  Mid-Morning Flash
    #   UTC 06:30 -> IST 12:00  Category Spotlight (lunch)
    #   UTC 09:30 -> IST 15:00  Platform Spotlight (afternoon)
    #   UTC 12:30 -> IST 18:00  Prime Time Flash
    #   UTC 14:30 -> IST 20:00  Evening Category Spotlight
    #   UTC 16:30 -> IST 22:00  Late Night Picks
    schedule.every().day.at("01:30").do(trigger_broadcast)
    schedule.every().day.at("04:30").do(trigger_broadcast)
    schedule.every().day.at("06:30").do(trigger_broadcast)
    schedule.every().day.at("09:30").do(trigger_broadcast)
    schedule.every().day.at("12:30").do(trigger_broadcast)
    schedule.every().day.at("14:30").do(trigger_broadcast)
    schedule.every().day.at("16:30").do(trigger_broadcast)


    logger.info("Scheduler loop initialized.")
    while True:
        try:
            schedule.run_pending()
        except Exception as exc:
            # Log but never let a single job crash the scheduler thread
            logger.error("[Scheduler] Unhandled exception in run_pending, continuing: %s", exc, exc_info=True)
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
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    @app.route('/diagnose')
    def diagnose():
        """
        Comprehensive live diagnostic endpoint.
        Returns: ScraperAPI credit status, last pipeline run summary,
        and a live Meesho proxy probe.
        """
        import requests as req
        key = os.getenv("SCRAPERAPI_KEY", "")
        result = {
            "scraperapi_key_set":     bool(key),
            "scraperapi_key_preview": f"{key[:8]}..." if key else "MISSING",
            "scraperapi_credits":     {},
            "last_pipeline_run":      {},
            "live_meesho_probe":      {},
        }

        # ── 1. ScraperAPI account credits ─────────────────────────────────
        if key:
            try:
                r = req.get(
                    "https://api.scraperapi.com/account",
                    params={"api_key": key},
                    timeout=10,
                )
                if r.status_code == 200:
                    data = r.json()
                    remaining = int(data.get("requestCount", 0) or 0)
                    limit     = int(data.get("requestLimit", 5000) or 5000)
                    result["scraperapi_credits"] = {
                        "remaining": remaining,
                        "limit":     limit,
                        "used":      limit - remaining,
                        "pct_used":  round((limit - remaining) / max(limit, 1) * 100, 1),
                        "status":    "critical" if remaining < 200 else "low" if remaining < 500 else "ok",
                    }
                else:
                    result["scraperapi_credits"] = {"error": f"HTTP {r.status_code}"}
            except Exception as e:
                result["scraperapi_credits"] = {"error": str(e)}

        # ── 2. Last pipeline run from MongoDB ─────────────────────────────
        try:
            import pymongo
            client = pymongo.MongoClient(
                os.getenv("MONGO_URI") or os.getenv("MONGODB_URI"),
                serverSelectionTimeoutMS=5000,
            )
            db = client.shadowmerchant
            last_log = db.scrapelogs.find_one(
                {}, sort=[("run_at", pymongo.DESCENDING)]
            )
            if last_log:
                result["last_pipeline_run"] = {
                    "run_at":            last_log.get("run_at", "?").isoformat() if hasattr(last_log.get("run_at"), "isoformat") else str(last_log.get("run_at", "?")),
                    "elapsed_seconds":   last_log.get("elapsed_seconds", 0),
                    "total_collected":   last_log.get("total_collected", 0),
                    "saved":             last_log.get("saved", 0),
                    "scrapers":          last_log.get("scrapers", {}),
                    "scraper_times":     last_log.get("scraper_times_seconds", {}),
                    "status":            last_log.get("status", "unknown"),
                }
            active_count = db.deals.count_documents({"is_active": True})
            result["last_pipeline_run"]["active_deals_in_db"] = active_count
            client.close()
        except Exception as e:
            result["last_pipeline_run"] = {"error": str(e)}

        # ── 3. Live Meesho proxy probe (1 request only) ───────────────────
        if key:
            try:
                proxies = {
                    "http":  f"http://scraperapi:{key}@proxy-server.scraperapi.com:8001",
                    "https": f"http://scraperapi:{key}@proxy-server.scraperapi.com:8001",
                }
                payload = {
                    "query": "electronics", "type": "text_search",
                    "page": 1, "offset": 0, "limit": 3,
                    "cursor": None, "isDevicePhone": False,
                }
                headers = {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json",
                    "origin": "https://www.meesho.com",
                    "referer": "https://www.meesho.com/",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                }
                r2 = req.post(
                    "https://www.meesho.com/api/v1/products/search",
                    json=payload, headers=headers,
                    proxies=proxies, timeout=20, verify=False,
                )
                data = {}
                try:
                    data = r2.json()
                except Exception:
                    pass
                catalogs = data.get("catalogs", [])
                result["live_meesho_probe"] = {
                    "status":         r2.status_code,
                    "catalogs_found": len(catalogs),
                    "proxy_working":  r2.status_code == 200 and len(catalogs) > 0,
                    "first_item":     catalogs[0].get("hero_product_name", "?") if catalogs else None,
                }
            except Exception as e:
                result["live_meesho_probe"] = {"error": str(e), "proxy_working": False}

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

