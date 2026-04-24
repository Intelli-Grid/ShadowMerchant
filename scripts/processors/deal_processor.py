import uuid
from datetime import datetime
from processors.deal_scorer import score_deal
from scrapers.base_scraper import RawDeal
from utils.algolia import push_deals_to_algolia

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
        "deal_hash": raw.deal_hash,
        "price_history": [{
            "date": datetime.utcnow(),
            "price": raw.discounted_price
        }],
        "published_at": datetime.utcnow(),
        "scraped_at": datetime.utcnow(),
        "expires_at": raw.expires_at,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

def process_deals(raw_deals: list[RawDeal], db) -> dict:
    stats = {"new": 0, "updated": 0, "skipped": 0}
    algolia_updates = []

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
                db.deals.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "discounted_price": raw.discounted_price,
                            "discount_percent": raw.discount_percent,
                            "category": raw.category,  # also fix category on update
                            "updated_at": datetime.utcnow()
                        },
                        "$push": {"price_history": {
                            "date": datetime.utcnow(),
                            "price": raw.discounted_price
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
            # New deal — score it, then insert
            deal_doc = build_deal_document(raw)
            deal_doc["deal_score"] = score_deal(raw)
            deal_doc["is_pro_exclusive"] = False
            result = db.deals.insert_one(deal_doc)
            deal_doc["_id"] = result.inserted_id
            algolia_updates.append(deal_doc)
            stats["new"] += 1

    if algolia_updates:
        push_deals_to_algolia(algolia_updates)

    return stats
