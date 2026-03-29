import uuid
from datetime import datetime
from processors.deal_scorer import score_deal
from scrapers.base_scraper import RawDeal

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
        "category": raw.category,
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

    for raw in raw_deals:
        # Skip deals with less than 20% discount
        if raw.discount_percent < 20:
            stats["skipped"] += 1
            continue

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
                            "updated_at": datetime.utcnow()
                        },
                        "$push": {"price_history": {
                            "date": datetime.utcnow(),
                            "price": raw.discounted_price
                        }}
                    }
                )
                stats["updated"] += 1
            else:
                stats["skipped"] += 1
        else:
            # New deal — score it, then insert
            deal_doc = build_deal_document(raw)
            deal_doc["deal_score"] = score_deal(raw)
            deal_doc["is_pro_exclusive"] = False
            db.deals.insert_one(deal_doc)
            stats["new"] += 1

    return stats
