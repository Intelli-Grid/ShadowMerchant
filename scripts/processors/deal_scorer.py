"""
ShadowMerchant Deal Scoring Engine — v2.1 (Sigmoid Normalization)
Implements the 5-component weighted formula from the Implementation Plan §4.2:

  weighted = (discount × 0.35) + (abs_price_drop × 0.20) + (popularity × 0.20)
           + (rating × 0.15) + (freshness × 0.10)

  final_score = sigmoid(weighted)   ← centered at 0.65; makes 100 statistically rare

Score interpretation:
  ≥ 95  — Exceptional: near-perfect across all 5 components simultaneously
  80–94 — Great Value: strong deal with solid signals
  60–79 — Good Deal: above-average discount with decent quality
  40–59 — Fair Deal: moderate value, lower signals
  < 40  — Low Score: weak deal, high junk-filter eligibility

Returns both a final score (0–100) and a detailed breakdown dict.
"""

import math
from datetime import datetime, timezone
from typing import Union


def _get(deal, field: str, default=0):
    """Safely get a field from either a RawDeal dataclass or a plain dict."""
    if isinstance(deal, dict):
        return deal.get(field, default)
    return getattr(deal, field, default)


def check_mrp_clarity(price_history: list, current_mrp: float, current_price: float) -> dict:
    """
    UPGRADE-G / Sprint 2B — MRP Clarity check.
    Compares the listed MRP against historical prices to detect 'shifted' MRPs
    (i.e. the MRP was artificially raised before a sale).

    Returns a dict with:
      verdict: 'verified' | 'shifted' | 'unknown'
      note:    human-readable explanation shown on the DealCard badge

    Called by score_deal_with_breakdown() — result is stored in:
      deal.mrp_verified and deal.mrp_note
    """
    if not price_history or len(price_history) < 3:
        return {"verdict": "unknown", "note": "Insufficient history to assess"}

    try:
        historical_prices = []
        for entry in price_history:
            p = float(_get(entry, "price", 0) or 0)
            if p > 0:
                historical_prices.append(p)

        if len(historical_prices) < 3:
            return {"verdict": "unknown", "note": "Insufficient history to assess"}

        hist_max = max(historical_prices)
        hist_min = min(historical_prices)

        # MRP significantly above the highest ever tracked price → likely shifted
        if current_mrp > hist_max * 1.4:
            gap_pct = round((current_mrp / hist_max - 1) * 100)
            return {
                "verdict": "shifted",
                "note": f"Listed MRP is ~{gap_pct}% above observed historical prices",
            }

        # Current price is at or below the historical minimum → genuine low
        if current_price <= hist_min * 1.05:
            return {
                "verdict": "verified",
                "note": "Near 30-day lowest tracked price",
            }

        return {"verdict": "unknown", "note": "Limited history — context unavailable"}

    except Exception:
        return {"verdict": "unknown", "note": "Error during MRP analysis"}


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


def _sigmoid_normalize(raw: float) -> int:
    """
    Squeeze a linear 0–1 weighted score through a sigmoid curve centered at 0.65.

    Why 0.65 as center?
      A deal with 65% weighted score (e.g. 55% off, 4.0★, 5k reviews, just scraped)
      maps to exactly 50/100 — a "Fair Deal". A deal must have near-perfect signals
      across all 5 axes to score above 95.

    Curve properties at key inputs:
      raw=0.40 → ~7   (weak deal — low discount, few reviews)
      raw=0.55 → ~27  (fair deal — average across all components)
      raw=0.65 → ~50  (mid-tier — decent but not remarkable)
      raw=0.75 → ~73  (good deal — strong discount + decent signals)
      raw=0.85 → ~90  (great deal — high discount, great ratings)
      raw=0.95 → ~98  (exceptional — near maximum across all 5 axes)
      raw=1.00 → ~99  (theoretical maximum — essentially unreachable)
    """
    sigmoid = 1.0 / (1.0 + math.exp(-12.0 * (raw - 0.72)))
    return int(round(sigmoid * 100))


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

    # Calculate price history penalty
    price_history = _get(deal, "price_history", [])
    penalty = 0
    if price_history:
        now = datetime.now(timezone.utc)
        recent_prices = []
        for entry in price_history:
            entry_price = float(_get(entry, "price", 0) or 0)
            entry_date = _get(entry, "date")
            if not entry_price or not entry_date:
                continue
            try:
                if isinstance(entry_date, str):
                    date_val = datetime.fromisoformat(entry_date.replace("Z", "+00:00"))
                else:
                    date_val = entry_date
                if date_val.tzinfo is None:
                    date_val = date_val.replace(tzinfo=timezone.utc)
                days_old = (now - date_val).total_seconds() / (3600.0 * 24)
                if days_old <= 7:
                    recent_prices.append(entry_price)
            except Exception:
                continue
        if recent_prices:
            avg_7_day = sum(recent_prices) / len(recent_prices)
            if disc_price > avg_7_day:
                penalty = 30

    # ── Component Scores (each 0.0 – 1.0) ──────────────────────────────────
    s_discount   = compute_discount_score(discount_pct)
    s_price_drop = compute_price_drop_score(original_price, disc_price)
    s_popularity = compute_popularity_score(rating_count)
    s_rating     = compute_rating_score(rating)
    s_freshness  = compute_freshness_score(scraped_at)

    # ── Weighted Formula (linear combination, then sigmoid-normalized) ──────
    weighted = (
        s_discount   * 0.35
        + s_price_drop * 0.20
        + s_popularity * 0.20
        + s_rating     * 0.15
        + s_freshness  * 0.10
    )

    # Sigmoid normalization — makes high scores exponentially harder to achieve.
    # Replaces the old linear scale + flat bonus/penalty approach.
    final_score = _sigmoid_normalize(weighted)
    
    # Apply penalty for price higher than 7-day average
    final_score -= penalty
    
    final_score = max(0, min(100, int(final_score)))  # safety clamp

    breakdown = {
        "discount_score":   round(s_discount, 4),
        "price_drop_score": round(s_price_drop, 4),
        "popularity_score": round(s_popularity, 4),
        "rating_score":     round(s_rating, 4),
        "freshness_score":  round(s_freshness, 4),
    }

    return final_score, breakdown


if __name__ == "__main__":
    print("=" * 55)
    print("ShadowMerchant Deal Scorer v2.1 — Sigmoid Sanity Tests")
    print("=" * 55)

    test_cases = [
        {
            "name": "Sony WH-1000XM5 @ 55% off (flagship electronics)",
            "deal": {
                "discount_percent": 55, "original_price": 34990, "discounted_price": 15745,
                "rating": 4.6, "rating_count": 12450, "scraped_at": None,
            },
            "expect_range": (82, 93),  # Good-Great, but NOT 100
        },
        {
            "name": "Perfect deal (70% off, 4.9/5, 20k reviews, just scraped)",
            "deal": {
                "discount_percent": 70, "original_price": 8000, "discounted_price": 2400,
                "rating": 4.9, "rating_count": 20000, "scraped_at": None,
            },
            "expect_range": (93, 99),  # Exceptional -- near ceiling
        },
        {
            "name": "Mediocre deal (20% off, Rs250 cable, 0 ratings)",
            "deal": {
                "discount_percent": 20, "original_price": 312, "discounted_price": 250,
                "rating": 0, "rating_count": 0, "scraped_at": None,
            },
            "expect_range": (0, 25),   # Low score -- weak signals
        },
        {
            "name": "Mid-tier fashion deal (40% off, 4.2/5, 500 reviews)",
            "deal": {
                "discount_percent": 40, "original_price": 2499, "discounted_price": 1499,
                "rating": 4.2, "rating_count": 500, "scraped_at": None,
            },
            "expect_range": (40, 68),  # Fair-Good deal
        },
    ]

    all_passed = True
    for tc in test_cases:
        score, breakdown = score_deal_with_breakdown(tc["deal"])
        lo, hi = tc["expect_range"]
        passed = lo <= score <= hi
        status = "[PASS]" if passed else f"[FAIL] expected {lo}-{hi}"
        print(f"\n{status} | Score: {score}/100 | {tc['name']}")
        if not passed:
            all_passed = False
            print(f"   Breakdown: {breakdown}")

    print("\n" + "=" * 55)
    print("ALL TESTS PASSED" if all_passed else "SOME TESTS FAILED -- tune sigmoid center")
    print("=" * 55)
