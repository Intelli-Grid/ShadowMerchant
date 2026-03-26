"""
ShadowMerchant Deduplicator — v1.0
Detects cross-platform duplicate deals using fuzzy title matching.

If two deals from different platforms have a title similarity > 85%,
they are treated as the same product. The lower-priced record is kept
as the canonical deal, and the other is appended to alternate_links[].

Usage:
    from processors.deduplicator import deduplicate_deals
    cleaned_deals = deduplicate_deals(raw_deals)
"""

import re
import logging
from difflib import SequenceMatcher
from typing import Union

logger = logging.getLogger("deduplicator")

# Similarity threshold above which two deals are considered the same product
SIMILARITY_THRESHOLD = 0.85

# Tokens to strip before comparison (model numbers, filler words, etc.)
_STRIP_PATTERN = re.compile(
    r"\b(the|a|an|with|for|and|or|by|in|of|to|from|new|latest|"
    r"edition|version|pack|combo|set|kit|bundle|india|genuine|"
    r"original|official|model|series|gen|generation)\b",
    re.IGNORECASE,
)
_WHITESPACE_PATTERN = re.compile(r"\s+")


def _normalize(title: str) -> str:
    """Lowercase, strip punctuation, remove filler words for comparison."""
    title = title.lower()
    title = re.sub(r"[^\w\s]", " ", title)         # remove punctuation
    title = _STRIP_PATTERN.sub(" ", title)           # remove filler words
    title = _WHITESPACE_PATTERN.sub(" ", title)      # collapse spaces
    return title.strip()


def _similarity(a: str, b: str) -> float:
    """Returns ratio 0.0–1.0 of how similar two strings are."""
    return SequenceMatcher(None, a, b).ratio()


def _get(deal, field, default=""):
    if isinstance(deal, dict):
        return deal.get(field, default)
    return getattr(deal, field, default)


def _to_dict(deal) -> dict:
    """Convert a RawDeal dataclass to a plain dict for uniform handling."""
    if isinstance(deal, dict):
        return deal
    d = deal.__dict__.copy()
    # Computed properties
    d["discount_percent"] = deal.discount_percent
    d["deal_hash"] = deal.deal_hash
    return d


def deduplicate_deals(deals: list) -> list:
    """
    Scans a list of deals (RawDeal objects or dicts) and merges cross-platform
    duplicates. Returns a deduplicated list of dicts.

    - If similarity > SIMILARITY_THRESHOLD, keep the cheaper one as canonical.
    - Append the more-expensive duplicate's URL/price to alternate_links[].
    """
    if not deals:
        return []

    normalized = []  # list of (norm_title, dict_deal)
    for deal in deals:
        d = _to_dict(deal)
        norm = _normalize(str(_get(d, "title", "")))
        normalized.append((norm, d))

    canonical: list[dict] = []

    for i, (norm_a, deal_a) in enumerate(normalized):
        is_duplicate = False

        for j, existing in enumerate(canonical):
            norm_b = _normalize(str(existing.get("title", "")))
            sim = _similarity(norm_a, norm_b)

            if sim >= SIMILARITY_THRESHOLD:
                is_duplicate = True
                # Keep the cheaper one as canonical
                price_a = float(deal_a.get("discounted_price", 0) or 0)
                price_b = float(existing.get("discounted_price", 0) or 0)

                if price_a < price_b:
                    # deal_a is cheaper — promote it to canonical, demote existing
                    alt_link = {
                        "source": existing.get("platform", existing.get("source_platform", "unknown")),
                        "url": existing.get("product_url") or existing.get("affiliate_url", ""),
                        "price": price_b,
                    }
                    deal_a.setdefault("alternate_links", []).append(alt_link)
                    # Merge any existing alternate_links from the demoted deal
                    deal_a["alternate_links"].extend(existing.get("alternate_links", []))
                    canonical[j] = deal_a
                else:
                    # existing is cheaper — append deal_a to its alternates
                    alt_link = {
                        "source": deal_a.get("platform", deal_a.get("source_platform", "unknown")),
                        "url": deal_a.get("product_url") or deal_a.get("affiliate_url", ""),
                        "price": price_a,
                    }
                    existing.setdefault("alternate_links", []).append(alt_link)

                logger.debug(
                    f"Duplicate ({sim:.0%}): '{deal_a.get('title', '')[:40]}' "
                    f"[{deal_a.get('platform', '?')}] ≈ '{existing.get('title', '')[:40]}' "
                    f"[{existing.get('platform', '?')}]"
                )
                break

        if not is_duplicate:
            deal_a.setdefault("alternate_links", [])
            canonical.append(deal_a)

    removed = len(deals) - len(canonical)
    if removed:
        logger.info(f"Deduplicator: merged {removed} cross-platform duplicate(s). {len(canonical)} unique deals remain.")

    return canonical


if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    sample = [
        {"title": "Sony WH-1000XM5 Wireless Headphones", "platform": "amazon",   "discounted_price": 17990, "product_url": "https://amzn.to/A", "alternate_links": []},
        {"title": "Sony WH 1000XM5 Noise Cancelling",    "platform": "flipkart", "discounted_price": 19990, "product_url": "https://fkrt.it/B", "alternate_links": []},
        {"title": "boAt Rockerz 550 Bluetooth Over Ear",  "platform": "amazon",   "discounted_price": 1299,  "product_url": "https://amzn.to/C", "alternate_links": []},
    ]

    result = deduplicate_deals(sample)
    for d in result:
        print(f"✅ {d['title'][:50]} | ₹{d['discounted_price']} | alts: {len(d['alternate_links'])}")
