"""
Trend Analyzer — ShadowMerchant
Analyzes current Google Trends + deal performance data to recommend:
  1. Which categories/keywords to scrape
  2. Which deal types are likely to convert
  3. Scores each keyword by trend velocity + conversion potential

Outputs a JSON report written to MongoDB (trends collection) for the
frontend "Smart Picks" feature and for the scraper pipeline to consume.

Usage:
    python trend_analyzer.py              # Run full analysis
    python trend_analyzer.py --dry-run    # Print results without saving
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger("trend_analyzer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Category keywords to analyze ─────────────────────────────────────────────
SEED_CATEGORIES = {
    "electronics": [
        "bluetooth headphones india", "gaming laptop offer", "smartwatch sale india",
        "TWS earbuds discount", "monitor deal india", "smartphone offer flipkart",
    ],
    "fashion": [
        "sneakers sale india", "summer dress offer myntra", "men shirt discount",
        "running shoes deal", "kurtis sale india",
    ],
    "beauty": [
        "skincare sale india", "nykaa best deal", "hair care offer india",
        "sunscreen discount", "moisturizer sale",
    ],
    "home": [
        "air purifier sale india", "mixer grinder offer", "smart tv deal india",
        "kitchen appliance discount", "vacuum cleaner sale",
    ],
}

# Platform → category mapping (tells scrapers where to look)
PLATFORM_CATEGORY_MAP = {
    "amazon":   ["electronics", "home"],
    "flipkart": ["electronics", "home", "fashion"],
    "myntra":   ["fashion"],
    "nykaa":    ["beauty"],
    "meesho":   ["fashion"],
    "croma":    ["electronics"],
}


def get_google_trends(keywords: list[str], geo: str = "IN") -> dict:
    """Fetch interest-over-time from Google Trends via pytrends."""
    try:
        from pytrends.request import TrendReq
        pt = TrendReq(hl="en-IN", tz=330, timeout=(10, 25), retries=2, backoff_factor=0.5)
        scores = {}
        # pytrends has a 5-keyword limit per request
        for i in range(0, len(keywords), 5):
            batch = keywords[i:i + 5]
            try:
                pt.build_payload(batch, cat=0, timeframe="now 7-d", geo=geo)
                df = pt.interest_over_time()
                if not df.empty:
                    for kw in batch:
                        if kw in df.columns:
                            scores[kw] = int(df[kw].mean())
                import time; time.sleep(1.5)  # be nice to Google
            except Exception as e:
                logger.warning(f"pytrends batch failed for {batch}: {e}")
        return scores
    except ImportError:
        logger.warning("pytrends not installed — skipping Google Trends. Run: pip install pytrends")
        return {}
    except Exception as e:
        logger.error(f"Google Trends error: {e}")
        return {}


def get_db_deal_performance() -> dict:
    """
    Query MongoDB for deal click/conversion performance by category.
    Returns {category: avg_deal_score} to weight trending recommendations.
    """
    try:
        import pymongo
        client = pymongo.MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000)
        db = client.shadowmerchant
        pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {
                "_id": "$category",
                "avg_score":    {"$avg": "$deal_score"},
                "avg_discount": {"$avg": "$discount_percent"},
                "total_deals":  {"$sum": 1},
            }},
        ]
        results = list(db.deals.aggregate(pipeline))
        client.close()
        return {r["_id"]: r for r in results if r["_id"]}
    except Exception as e:
        logger.warning(f"DB performance query failed: {e} — using defaults")
        return {}


def score_keyword(
    keyword: str,
    category: str,
    trend_score: int,
    db_perf: dict,
) -> dict:
    """
    Compute a composite 'scrape priority' score (0-100) for a keyword.
    Factors: trend velocity, category avg deal score, discount depth.
    """
    cat_data = db_perf.get(category, {})
    avg_deal_score  = float(cat_data.get("avg_score", 50) or 50)
    avg_discount    = float(cat_data.get("avg_discount", 20) or 20)
    total_deals     = int(cat_data.get("total_deals", 0) or 0)

    # Normalise each factor to 0-1
    trend_factor    = min(trend_score / 100, 1.0)
    deal_factor     = min(avg_deal_score / 100, 1.0)
    discount_factor = min(avg_discount / 80, 1.0)     # 80% max realistic discount
    supply_factor   = 1.0 if total_deals < 50 else 0.5  # prefer under-supplied categories

    composite = (
        (trend_factor    * 0.40) +
        (deal_factor     * 0.30) +
        (discount_factor * 0.20) +
        (supply_factor   * 0.10)
    ) * 100

    return {
        "keyword":        keyword,
        "category":       category,
        "trend_score":    trend_score,
        "priority_score": round(composite, 1),
        "avg_deal_score": round(avg_deal_score, 1),
        "avg_discount":   round(avg_discount, 1),
        "db_deals":       total_deals,
    }


def generate_ai_summary(ranked: list[dict]) -> str:
    """Use Groq to generate a human-readable deal recommendation."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "AI summary unavailable (GROQ_API_KEY not set)"
    try:
        import requests as req
        top5 = ranked[:5]
        prompt = (
            "You are an Indian deal curator. Based on the following trending keywords and their priority scores, "
            "write a 2-3 sentence recommendation for which deals to focus on today.\n\n"
            f"Top keywords:\n" +
            "\n".join([f"- {r['keyword']} (category: {r['category']}, priority: {r['priority_score']}/100)" for r in top5]) +
            "\n\nRecommendation (in plain English, max 80 words):"
        )
        resp = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "llama3-8b-8192", "messages": [{"role": "user", "content": prompt}], "max_tokens": 120},
            timeout=15,
        )
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"Groq summary failed: {e}")
        return "AI summary unavailable"


def recommend_scraper_targets(ranked: list[dict]) -> dict:
    """
    Based on top-ranked keywords, decide which scrapers to prioritize
    and what search queries to run.
    Returns {platform: [query1, query2, ...]}
    """
    # Group top-10 keywords by category
    cat_keywords: dict[str, list[str]] = {}
    for item in ranked[:10]:
        cat = item["category"]
        cat_keywords.setdefault(cat, []).append(item["keyword"])

    targets: dict[str, list[str]] = {}
    for platform, categories in PLATFORM_CATEGORY_MAP.items():
        queries = []
        for cat in categories:
            queries.extend(cat_keywords.get(cat, [])[:2])  # max 2 per category
        if queries:
            targets[platform] = queries[:4]  # max 4 queries per platform

    return targets


def save_to_db(report: dict) -> bool:
    """Upsert today's trend report into MongoDB trends collection."""
    try:
        import pymongo
        client = pymongo.MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000)
        db = client.shadowmerchant
        db.trends.update_one(
            {"date": report["date"]},
            {"$set": report},
            upsert=True,
        )
        client.close()
        logger.info("✅ Trend report saved to MongoDB trends collection")
        return True
    except Exception as e:
        logger.error(f"Failed to save trend report: {e}")
        return False


def save_targets_for_pipeline(targets: dict) -> None:
    """Write scraper targets to a JSON file so run_pipeline.py can load them."""
    path = Path(__file__).parent.parent / "scraper_targets.json"
    with open(path, "w") as f:
        json.dump(targets, f, indent=2)
    logger.info(f"Scraper targets written to {path}")


def run_analysis(dry_run: bool = False) -> dict:
    logger.info("🔍 Starting Trend Analysis...")

    # 1. Collect all keywords
    all_keywords = [kw for kws in SEED_CATEGORIES.values() for kw in kws]

    # 2. Google Trends scores
    logger.info("Fetching Google Trends data (geo=IN)...")
    trend_scores = get_google_trends(all_keywords, geo="IN")
    logger.info(f"Got trend scores for {len(trend_scores)} keywords")

    # 3. DB performance data
    logger.info("Querying MongoDB deal performance...")
    db_perf = get_db_deal_performance()

    # 4. Score every keyword
    scored = []
    for category, keywords in SEED_CATEGORIES.items():
        for kw in keywords:
            ts = trend_scores.get(kw, 0)
            scored.append(score_keyword(kw, category, ts, db_perf))

    ranked = sorted(scored, key=lambda x: x["priority_score"], reverse=True)

    # 5. AI summary
    logger.info("Generating AI recommendation...")
    ai_summary = generate_ai_summary(ranked)

    # 6. Scraper targets
    targets = recommend_scraper_targets(ranked)

    report = {
        "date":             datetime.utcnow().strftime("%Y-%m-%d"),
        "generated_at":     datetime.utcnow().isoformat(),
        "top_keywords":     ranked[:15],
        "scraper_targets":  targets,
        "ai_recommendation": ai_summary,
        "db_performance":   db_perf,
    }

    # Print summary
    print("\n" + "=" * 60)
    print("  TREND ANALYSIS REPORT")
    print("=" * 60)
    print(f"\n  📅 Date: {report['date']}")
    print(f"\n  🤖 AI Recommendation:\n  {ai_summary}\n")
    print("  🔝 Top 10 Keywords to Scrape:")
    for i, r in enumerate(ranked[:10], 1):
        print(f"  {i:2}. [{r['priority_score']:5.1f}] {r['keyword']:<40} ({r['category']})")
    print(f"\n  🎯 Scraper Targets:")
    for platform, queries in targets.items():
        print(f"      {platform:<10}: {', '.join(queries[:2])}")
    print("=" * 60 + "\n")

    if not dry_run:
        save_to_db(report)
        save_targets_for_pipeline(targets)
    else:
        logger.info("[DRY RUN] — Not saving to DB or writing targets file")

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ShadowMerchant Trend Analyzer")
    parser.add_argument("--dry-run", action="store_true", help="Print results without saving")
    args = parser.parse_args()
    run_analysis(dry_run=args.dry_run)
