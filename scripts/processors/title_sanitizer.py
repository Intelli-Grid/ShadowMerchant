"""
ShadowMerchant Title Sanitizer — v1.0
Cleans scraped product titles before MongoDB upsert.

Rejects:
  - Titles under 15 characters (e.g., "MOUSE")
  - Titles under 3 words (e.g., "HD Camera")
  - Meesho ALL-CAPS generic titles with <= 3 words (e.g., "T SHIRT")
Fixes:
  - Brand prefix duplication (e.g., "Sony Sony WH-1000XM5" → "Sony WH-1000XM5")
  - Excessively long keyword-stuffed titles (truncated to 20 words)
"""
import logging

logger = logging.getLogger("title_sanitizer")

# Minimum title quality thresholds
MIN_CHARS = 15           # "MOUSE" (5 chars) → rejected
MIN_WORDS = 3            # "HD Camera" (2 words) → rejected
MAX_WORDS = 20           # Trim overly long keyword-stuffed titles


def deduplicate_brand_prefix(title: str) -> str:
    """
    Fix: 'Sony Sony WH-1000XM5' → 'Sony WH-1000XM5'
    Splits on first space and checks if first word appears again immediately.
    """
    words = title.split()
    if len(words) >= 2 and words[0].lower() == words[1].lower():
        return " ".join(words[1:])
    return title


def truncate_to_words(title: str, max_words: int = MAX_WORDS) -> str:
    """Trim excessively keyword-stuffed titles to MAX_WORDS words."""
    words = title.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]) + "…"
    return title


def sanitize_title(title: str, platform: str = "") -> "str | None":
    """
    Full sanitization pipeline. Returns None if title fails quality gates
    (caller should skip the deal entirely).

    Steps:
      1. Strip leading/trailing whitespace
      2. Reject if too short or too few words
      3. Meesho-specific: strip ALL-CAPS single/double/triple-word titles
      4. Remove brand-prefix duplication (Amazon mainly)
      5. Truncate to MAX_WORDS
    """
    if not title or not isinstance(title, str):
        return None

    title = title.strip()

    # Gate 1: Minimum length
    if len(title) < MIN_CHARS:
        logger.debug(f"[sanitize] Rejected short title: '{title}'")
        return None

    # Gate 2: Minimum word count
    words = title.split()
    if len(words) < MIN_WORDS:
        logger.debug(f"[sanitize] Rejected low word-count title: '{title}'")
        return None

    # Gate 3: Meesho ALL-CAPS generic titles (e.g., "MOUSE", "CHARGER", "T SHIRT")
    if platform == "meesho" and title.isupper() and len(words) <= 3:
        logger.debug(f"[sanitize] Rejected Meesho ALL-CAPS title: '{title}'")
        return None

    # Gate 4: Brand prefix deduplication (Amazon mainly)
    title = deduplicate_brand_prefix(title)

    # Gate 5: Truncate keyword-stuffed titles
    title = truncate_to_words(title)

    return title


def is_title_quality(title: str) -> bool:
    """Quick boolean check — used in scoring to penalize weak titles."""
    if not title:
        return False
    return len(title) >= MIN_CHARS and len(title.split()) >= MIN_WORDS
