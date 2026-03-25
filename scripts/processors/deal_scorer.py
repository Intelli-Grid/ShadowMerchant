from scrapers.base_scraper import RawDeal
from typing import Union

def score_deal(deal: Union[RawDeal, dict]) -> int:
    """Score a deal 0-100. Accepts either a RawDeal object or a plain dict."""
    score = 0

    def _get(field, default=0):
        if isinstance(deal, dict):
            return deal.get(field, default)
        return getattr(deal, field, default)

    discount_pct  = float(_get("discount_percent", 0) or 0)
    rating        = float(_get("rating", 0) or 0)
    rating_count  = int(_get("rating_count", 0) or 0)
    disc_price    = float(_get("discounted_price", 0) or 0)
    brand         = str(_get("brand", "") or "").lower()
    category      = str(_get("category", "") or "").lower()

    # Discount % (max 40 points)
    if discount_pct >= 70:   score += 40
    elif discount_pct >= 50: score += 30
    elif discount_pct >= 40: score += 20
    elif discount_pct >= 30: score += 10
    elif discount_pct >= 15: score += 5

    # Rating (max 20 points)
    if rating >= 4.5:   score += 20
    elif rating >= 4.0: score += 15
    elif rating >= 3.5: score += 8

    # Rating count (max 10 points)
    if rating_count >= 10000:  score += 10
    elif rating_count >= 1000: score += 7
    elif rating_count >= 100:  score += 4

    # Price in impulse range Rs.200-Rs.5000 (10 points)
    if 200 <= disc_price <= 5000: score += 10

    # Known brand bonus (10 points)
    known_brands = [
        "samsung", "apple", "boat", "sony", "lg", "mi", "realme",
        "nike", "adidas", "lakme", "maybelline", "prestige", "levi"
    ]
    if any(b in brand for b in known_brands): score += 10

    # Category bonus (10 points)
    if category in ["fashion", "beauty", "electronics"]: score += 10

    return min(score, 100)
