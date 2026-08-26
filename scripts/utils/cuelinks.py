"""
CueLinks Affiliate Link Converter
===================================
Converts Myntra, Nykaa, Meesho, TataCliq retail URLs into CueLinks
affiliate smartlinks.

INACTIVE until CUELINKS_SID is set in .env.
No other code changes needed after setting that one var.

Integration:
    from utils.cuelinks import convert_to_affiliate

    # Before save_to_db():
    for deal in all_deals:
        if hasattr(deal, 'source_platform') and deal.source_platform in CUELINKS_PLATFORMS:
            deal.product_url = convert_to_affiliate(deal.product_url, deal.source_platform)

Activation:
    Add to scripts/.env:
        CUELINKS_SID=<your_sid>   # Set after CueLinks approves — activates automatically

CueLinks dashboard: https://publisher.cuelinks.com
"""
import os
import logging
import requests
from urllib.parse import quote

logger = logging.getLogger(__name__)

CUELINKS_SID = os.getenv("CUELINKS_SID")
CUELINKS_PLATFORMS = {"myntra", "nykaa", "meesho", "tatacliq"}


def convert_to_affiliate(url: str, platform: str) -> str:
    """
    Returns a CueLinks affiliate smartlink for supported platforms.

    Behaviour:
    - If CUELINKS_SID is not set: returns the original URL unchanged (silent passthrough).
      This allows the converter to be imported freely without activation risk.
    - If platform is not in CUELINKS_PLATFORMS: returns original URL unchanged.
      (Amazon and Flipkart use their own dedicated affiliate systems.)
    - If the CueLinks API call fails for any reason: returns original URL unchanged.
      Pipeline must never break because of affiliate link conversion.

    Always returns a valid URL — never raises, never returns None or empty string.
    """
    if not CUELINKS_SID:
        # Not yet approved by CueLinks — pass through silently.
        return url

    if platform.lower() not in CUELINKS_PLATFORMS:
        # Amazon and Flipkart are handled by their own affiliate systems.
        return url

    if not url or not url.startswith("http"):
        return url

    try:
        smartlink = (
            f"https://cl.cuelinks.com/?sid={CUELINKS_SID}"
            f"&url={quote(url, safe='')}"
        )
        resp = requests.get(smartlink, timeout=5, allow_redirects=True)
        if resp.status_code == 200 and resp.url and resp.url != smartlink:
            logger.debug(f"[CueLinks] Converted {platform} URL → {resp.url[:80]}...")
            return resp.url
        # Non-200 or redirect didn't resolve — fall back silently.
        logger.debug(
            f"[CueLinks] Conversion returned HTTP {resp.status_code} for {platform} "
            f"— using original URL"
        )
        return url
    except Exception as e:
        logger.warning(f"[CueLinks] Conversion failed for {platform}: {e}")
        return url


def is_active() -> bool:
    """Returns True if CueLinks affiliate conversion is currently enabled."""
    return bool(CUELINKS_SID)
