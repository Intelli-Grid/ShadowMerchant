from scrapers.base_scraper import RawDeal

def score_deal(deal: RawDeal) -> int:
    score = 0

    # Discount % (max 40 points)
    if deal.discount_percent >= 70: score += 40
    elif deal.discount_percent >= 50: score += 30
    elif deal.discount_percent >= 40: score += 20
    elif deal.discount_percent >= 30: score += 10

    # Rating (max 20 points)
    if deal.rating >= 4.5: score += 20
    elif deal.rating >= 4.0: score += 15
    elif deal.rating >= 3.5: score += 8

    # Rating count (max 10 points)
    if deal.rating_count >= 10000: score += 10
    elif deal.rating_count >= 1000: score += 7
    elif deal.rating_count >= 100: score += 4

    # Price in impulse range ₹200-₹5000 (10 points)
    if 200 <= deal.discounted_price <= 5000: score += 10

    # Known brand bonus (10 points)
    known_brands = ["samsung", "apple", "boat", "sony", "lg", "mi", "realme", 
                    "nike", "adidas", "lakme", "maybelline", "prestige"]
    if any(b in deal.brand.lower() for b in known_brands): score += 10

    # Category bonus (10 points)
    if deal.category.lower() in ["fashion", "beauty", "electronics"]: score += 10

    return min(score, 100)
