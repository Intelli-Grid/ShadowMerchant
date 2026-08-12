import uuid
from datetime import datetime, timezone
from processors.deal_scorer import score_deal
from scrapers.base_scraper import RawDeal
from utils.algolia import push_deals_to_algolia
from utils.slug_generator import make_deal_slug, make_unique_slug

# ─── T1-F: Category normalizer ────────────────────────────────────────────────
# Keyword → correct category overrides.
# Keys are lowercase title substrings; values are the target universal category.
# Order matters — more specific patterns first.
CATEGORY_KEYWORD_OVERRIDES: list[tuple[str, str]] = [
    # Books / stationery misclassified as electronics
    ("planner", "books"),
    ("organizer", "books"),
    ("diary", "books"),
    ("notebook", "books"),
    ("stationery", "books"),
    ("journal", "books"),
    ("sticky note", "books"),
    ("ball pen", "books"),
    ("gel pen", "books"),
    # Sports / fitness misclassified as fashion or electronics
    ("dumbbell", "sports"),
    ("barbell", "sports"),
    ("yoga mat", "sports"),
    ("resistance band", "sports"),
    ("weight machine", "sports"),
    ("exercise bike", "sports"),
    ("treadmill", "sports"),
    ("protein powder", "health"),
    ("whey protein", "health"),
    # Automotive misclassified as electronics
    ("soldering iron", "automotive"),
    ("car cleaner", "automotive"),
    ("car polish", "automotive"),
    ("tyre", "automotive"),
    ("helmet", "automotive"),
    # Home misclassified as electronics
    ("air purifier", "home"),
    ("water purifier", "home"),
    ("iron box", "home"),
    ("steam iron", "home"),
    ("induction cooktop", "home"),
    ("pressure cooker", "home"),
    ("mixer grinder", "home"),
    ("ceiling fan", "home"),
    # Beauty products in wrong category
    ("face wash", "beauty"),
    ("moisturizer", "beauty"),
    ("sunscreen", "beauty"),
    ("lipstick", "beauty"),
    ("mascara", "beauty"),
    ("foundation", "beauty"),
    ("serum", "beauty"),
    ("shampoo", "beauty"),
    ("conditioner", "beauty"),
]

VALID_CATEGORIES = {
    "electronics", "fashion", "beauty", "home", "sports",
    "books", "toys", "health", "automotive", "grocery", "travel", "gaming"
}

def normalize_category(raw: RawDeal) -> str:
    """
    Inspects the deal title and returns the correct universal category slug.
    Falls back to the scraper-provided category if no keyword override fires.
    Ensures the result is always a known valid category.
    """
    title_lower = raw.title.lower()
    for keyword, override_cat in CATEGORY_KEYWORD_OVERRIDES:
        if keyword in title_lower:
            return override_cat
    # Keep scraper-assigned category if it's valid; else fall back to 'electronics'
    cat = (raw.category or "").lower().strip()
    return cat if cat in VALID_CATEGORIES else "electronics"

# ──────────────────────────────────────────────────────────────────────────────

def build_deal_document(raw: RawDeal) -> dict:
    return {
        "deal_id": str(uuid.uuid4()),
        "title": raw.title,
        "description": "",
        "source_platform": raw.platform,
        "original_price": raw.original_price,
        "discounted_price": raw.discounted_price,
        "discount_percent": raw.discount_percent,
        "affiliate_url": raw.product_url,
        "image_url": raw.image_url,
        "category": raw.category,  # will be overwritten below after normalization
        "brand": raw.brand,
        "rating": raw.rating,
        "rating_count": raw.rating_count,
        "deal_type": raw.deal_type,
        "is_active": True,
        "is_available": True,
        "deal_hash": raw.deal_hash,
        "price_history": [{
            "date": datetime.now(timezone.utc),
            "price": raw.discounted_price
        }],
        "published_at": datetime.now(timezone.utc),
        "scraped_at": datetime.now(timezone.utc),
        "expires_at": raw.expires_at,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        # UPGRADE-G: MRP clarity defaults — scorer will update these after history builds
        "mrp_verified": "unknown",
        "mrp_note": None,
        # UPGRADE-H: bank offer — scrapers will populate this when they detect card offers
        "bank_offer": None,
    }


# UPGRADE-G: MRP Clarity check — compares listed MRP against observed price history
def check_mrp_clarity(price_history: list, current_mrp: float, current_price: float) -> dict:
    """
    Returns mrp_verified verdict and an explanatory note.
    Requires at least 3 data points; returns 'unknown' otherwise.
    """
    if not price_history or len(price_history) < 3:
        return {"verdict": "unknown", "note": "Insufficient history to assess"}

    historical_prices = [p["price"] for p in price_history]
    hist_max = max(historical_prices)
    hist_min = min(historical_prices)

    # If stated MRP is >40% above the highest price we've ever seen, it's likely inflated
    if current_mrp > hist_max * 1.4:
        gap_pct = round((current_mrp / hist_max - 1) * 100)
        return {
            "verdict": "shifted",
            "note": f"Listed MRP appears ~{gap_pct}% above observed historical prices"
        }

    # If current price is within 5% of the historical minimum, the discount is real
    if current_price <= hist_min * 1.05:
        return {"verdict": "verified", "note": "Near 30-day lowest tracked price"}

    return {"verdict": "unknown", "note": "Limited history — context unavailable"}



def process_deals(raw_deals: list[RawDeal], db) -> dict:
    stats = {"new": 0, "updated": 0, "skipped": 0}
    algolia_updates = []

    # SEO-FIX-02: Pre-load existing slugs to guarantee uniqueness within this run
    # Only fetch the slug field — minimal memory overhead even for large collections
    existing_slugs: set[str] = set(
        d["slug"] for d in db.deals.find({"slug": {"$exists": True}}, {"slug": 1})
        if d.get("slug")
    )
    # Track slugs generated in this batch (not yet in DB) to prevent intra-batch collisions
    batch_slugs: set[str] = set()

    for raw in raw_deals:
        # Skip deals with less than 20% discount
        if raw.discount_percent < 20:
            stats["skipped"] += 1
            continue

        # T1-F: Normalize category before any DB operation
        raw.category = normalize_category(raw)

        existing = db.deals.find_one({"deal_hash": raw.deal_hash})

        if existing:
            # Update price if changed
            if existing.get("discounted_price") != raw.discounted_price:
                # Build new price_history with the new point appended
                new_history = list(existing.get("price_history", [])) + [{
                    "date": datetime.now(timezone.utc),
                    "price": raw.discounted_price
                }]
                # UPGRADE-G: Recalculate MRP clarity on every price update
                mrp_result = check_mrp_clarity(new_history, raw.original_price, raw.discounted_price)

                db.deals.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "discounted_price": raw.discounted_price,
                            "discount_percent": raw.discount_percent,
                            "category": raw.category,
                            "mrp_verified": mrp_result["verdict"],
                            "mrp_note": mrp_result["note"],
                            "updated_at": datetime.now(timezone.utc)
                        },
                        # $slice: -90 keeps the 90 most-recent price points.
                        # Without this, documents grow unboundedly — a deal scraped
                        # 6x/day for 1 year accumulates 2,190 entries (~110KB).
                        # 90 points covers 15 days of 6-times-daily scraping —
                        # sufficient for the price chart and MRP clarity checks.
                        "$push": {"price_history": {
                            "$each": [{
                                "date": datetime.now(timezone.utc),
                                "price": raw.discounted_price
                            }],
                            "$slice": -90
                        }}
                    }
                )

                # Fetch the updated doc to sync to Algolia
                updated_doc = db.deals.find_one({"_id": existing["_id"]})
                if updated_doc:
                    algolia_updates.append(updated_doc)

                stats["updated"] += 1
            else:
                stats["skipped"] += 1
        else:
            # New deal — score it, generate slug, then insert
            deal_doc = build_deal_document(raw)
            deal_doc["deal_score"] = score_deal(raw)

            # Pro gating: score >= 55 AND discount >= 40% → Pro-exclusive (~10-15% of deals)
            _score = int(deal_doc.get("deal_score", 0))
            _disc  = int(deal_doc.get("discount_percent", 0))
            deal_doc["is_pro_exclusive"] = bool(_score >= 55 and _disc >= 40)

            # SEO-FIX-02: Assign a unique SEO slug
            try:
                base_slug = make_deal_slug(
                    raw.title,
                    raw.discount_percent,
                    raw.platform
                )
                slug = make_unique_slug(base_slug, existing_slugs | batch_slugs)
                deal_doc["slug"] = slug
                batch_slugs.add(slug)
            except Exception:
                pass  # Non-fatal: deal is still inserted, just without a slug

            result = db.deals.insert_one(deal_doc)
            deal_doc["_id"] = result.inserted_id
            algolia_updates.append(deal_doc)
            stats["new"] += 1

    if algolia_updates:
        push_deals_to_algolia(algolia_updates)

    return stats
