"""
ShadowMerchant Deal Scoring Engine — v2.0
Implements the 5-component weighted formula from the Implementation Plan §4.2:

  Score = (discount × 0.35) + (abs_price_drop × 0.20) + (popularity × 0.20)
        + (rating × 0.15) + (freshness × 0.10)

Returns both a final score (0–100) and a detailed breakdown dict.
"""

from datetime import datetime, timezone
from typing import Union


def _get(deal, field: str, default=0):
    """Safely get a field from either a RawDeal dataclass or a plain dict."""
    if isinstance(deal, dict):
        return deal.get(field, default)
    return getattr(deal, field, default)


def compute_discount_score(discount_pct: float) -> float:
    """
    Discount % component — weight 35%.
    Normalized 0–1. Capped at 1.0 if discount >= 70%.
    """
    return min(float(discount_pct) / 70.0, 1.0)


def compute_price_drop_score(original_price: float, discounted_price: float) -> float:
    """
    Absolute Price Drop component — weight 20%.
    Rewards large absolute ₹ drops, not just percentage.
    Formula: min((original - sale) / 3000.0, 1.0). (3000 INR savings = 1.0)
    """
    if original_price <= 0 or discounted_price <= 0:
        return 0.0
    if discounted_price >= original_price:
        return 0.0
    
    absolute_drop = original_price - discounted_price
    return min(absolute_drop / 3000.0, 1.0)


def compute_popularity_score(rating_count: int) -> float:
    """
    Popularity component — weight 20%.
    Uses review count as a proxy. Normalized to 10,000 reviews = 1.0.
    """
    return min(float(int(rating_count)) / 10_000.0, 1.0)


def compute_rating_score(rating: float) -> float:
    """
    Rating component — weight 15%.
    Normalized: rating / 5.0.
    """
    return min(float(rating) / 5.0, 1.0)


def compute_freshness_score(scraped_at=None) -> float:
    """
    Freshness decay component — weight 10%.
    A deal scraped right now = 1.0. A 7-day-old deal = 0.0.
    Formula: max(0, 1 - hours_old / 168)
    """
    if scraped_at is None:
        return 1.0  # Assume brand new if not specified

    now = datetime.now(timezone.utc)

    # Handle both timezone-aware and naive datetimes
    if isinstance(scraped_at, str):
        try:
            scraped_at = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
        except Exception:
            return 1.0

    if scraped_at.tzinfo is None:
        scraped_at = scraped_at.replace(tzinfo=timezone.utc)

    hours_old = (now - scraped_at).total_seconds() / 3600.0
    return max(0.0, 1.0 - hours_old / 168.0)


def score_deal(deal: Union[object, dict]) -> int:
    """
    Main scoring entry point. Accepts a RawDeal dataclass or a plain dict.
    Returns final deal score as integer 0–100 (for backward compatibility).
    """
    score, _ = score_deal_with_breakdown(deal)
    return score


def score_deal_with_breakdown(deal: Union[object, dict]) -> tuple[int, dict]:
    """
    Full scoring with breakdown. Returns (score_int, breakdown_dict).

    breakdown_dict keys:
      discount_score, price_drop_score, popularity_score, rating_score, freshness_score
    """
    discount_pct   = float(_get(deal, "discount_percent", 0) or 0)
    original_price = float(_get(deal, "original_price", 0) or 0)
    disc_price     = float(_get(deal, "discounted_price", 0) or 0)
    rating         = float(_get(deal, "rating", 0) or 0)
    rating_count   = int(_get(deal, "rating_count", 0) or 0)
    scraped_at     = _get(deal, "scraped_at", None) or _get(deal, "created_at", None)

    # ── Component Scores (each 0.0 – 1.0) ──────────────────────────────────
    s_discount   = compute_discount_score(discount_pct)
    s_price_drop = compute_price_drop_score(original_price, disc_price)
    s_popularity = compute_popularity_score(rating_count)
    s_rating     = compute_rating_score(rating)
    s_freshness  = compute_freshness_score(scraped_at)

    # ── Weighted Formula ────────────────────────────────────────────────────
    weighted = (
        s_discount   * 0.35
        + s_price_drop * 0.20
        + s_popularity * 0.20
        + s_rating     * 0.15
        + s_freshness  * 0.10
    )

    final_score = int(round(weighted * 100))
    
    # High-Value Premium Bonus: +15 points for expensive products that have decent savings.
    if disc_price > 1500 and (original_price - disc_price) > 500:
        final_score += 15
    # Junk Penalty: Demote super cheap items (like cables/diaries) so they don't trend.
    elif disc_price < 300:
        final_score -= 30

    final_score = max(0, min(100, final_score))

    breakdown = {
        "discount_score":   round(s_discount, 4),
        "price_drop_score": round(s_price_drop, 4),
        "popularity_score": round(s_popularity, 4),
        "rating_score":     round(s_rating, 4),
        "freshness_score":  round(s_freshness, 4),
    }

    return final_score, breakdown


if __name__ == "__main__":
    # Quick sanity test
    sample = {
        "title": "Sony WH-1000XM5",
        "discount_percent": 55,
        "original_price": 34990,
        "discounted_price": 15745,
        "rating": 4.6,
        "rating_count": 12450,
        "scraped_at": None,  # assume just scraped
    }
    score, breakdown = score_deal_with_breakdown(sample)
    print(f"Score: {score}/100")
    print(f"Breakdown: {breakdown}")
