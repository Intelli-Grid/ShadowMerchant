"""
Meesho Scraper — ScraperAPI residential proxy + direct JSON API
================================================================
Strategy: Use ScraperAPI's residential Indian IP as a proxy to call
Meesho's internal search API (JSON, no HTML parsing needed).

Why this works:
  - ScraperAPI RENDER mode returns 500 (Meesho blocks their headless Chrome)
  - Meesho's own IPs block Render's cloud IPs
  - But: ScraperAPI's residential proxy IPs look like real Indian users
  - We POST to Meesho's search JSON API through the proxy → real JSON response

ScraperAPI proxy credentials:
  host: proxy-server.scraperapi.com:8001
  user: scraperapi
  pass: <SCRAPERAPI_KEY>

Free tier: 5,000 credits/month (proxy mode = 1 credit per request)
Usage: 6 categories x 3 pages = 18 requests/run → ~277 runs/month on free tier.
"""
import logging
import os
import re
import sys
import time
from pathlib import Path

import requests
from requests.auth import HTTPProxyAuth
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv()
logger = logging.getLogger(__name__)

MEESHO_SEARCH_API = "https://www.meesho.com/api/v1/products/search"
SCRAPERAPI_PROXY  = "http://proxy-server.scraperapi.com:8001"

# Top 6 high-yield categories
CATEGORY_QUERIES = {
    "electronics": "electronics",
    "fashion":     "women fashion clothing",
    "beauty":      "beauty skincare",
    "home":        "home decor kitchen",
    "sports":      "sports fitness",
    "health":      "health wellness",
    "books":       "books novels",
    "toys":        "toys kids",
    "automotive":  "car accessories",
    "grocery":     "grocery food",
    "travel":      "travel bags luggage",
    "gaming":      "gaming accessories",
}

# Browser-like headers — same fingerprint as a real Indian Chrome user
BASE_HEADERS = {
    "accept":           "application/json, text/plain, */*",
    "accept-language":  "en-IN,en;q=0.9,hi;q=0.8",
    "content-type":     "application/json",
    "origin":           "https://www.meesho.com",
    "referer":          "https://www.meesho.com/",
    "sec-ch-ua":        '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest":   "empty",
    "sec-fetch-mode":   "cors",
    "sec-fetch-site":   "same-origin",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
}

DEFAULT_DISCOUNT_FACTOR = 1.35   # Assume 35% discount when no MRP is shown


class MeeshoScraper(BaseScraper):

    def __init__(self):
        super().__init__(platform_name="meesho")
        self.affiliate_tag   = os.getenv("MEESHO_AFFILIATE_TAG", "")
        self.scraperapi_key  = os.getenv("SCRAPERAPI_KEY", "")

    # ─────────────────────────────────────────────────────────────
    def _check_scraperapi_credits(self) -> int | None:
        """
        Calls the ScraperAPI account endpoint to get remaining credits.
        Returns remaining credits int, or None if the check fails.
        Logs a warning and triggers a Telegram alert when credits are low.
        """
        if not self.scraperapi_key:
            return None
        try:
            import requests as _req
            r = _req.get(
                "https://api.scraperapi.com/account",
                params={"api_key": self.scraperapi_key},
                timeout=10,
            )
            if r.status_code == 200:
                data = r.json()
                remaining = int(data.get("requestCount", 0) or 0)
                limit     = int(data.get("requestLimit", 5000) or 5000)
                used      = limit - remaining
                logger.info(
                    f"ScraperAPI credits: {remaining} remaining "
                    f"({used}/{limit} used this month)"
                )
                if remaining < 200:
                    msg = (
                        f"🔴 *ScraperAPI credits critically low!*\n"
                        f"Only {remaining} credits left ({used}/{limit} used).\n"
                        f"Meesho scraper will fail until credits reset or plan upgraded.\n"
                        f"Top up: https://dashboard.scraperapi.com"
                    )
                    logger.error(msg)
                    try:
                        import asyncio
                        from social.telegram_poster import post_admin_alert
                        asyncio.run(post_admin_alert(msg))
                    except Exception:
                        pass
                elif remaining < 500:
                    logger.warning(
                        f"ScraperAPI credits low: {remaining} left — "
                        f"consider upgrading plan before next pipeline run."
                    )
                return remaining
            else:
                logger.warning(f"ScraperAPI account check returned HTTP {r.status_code}")
        except Exception as e:
            logger.warning(f"ScraperAPI credit check failed: {e}")
        return None

    # ─────────────────────────────────────────────────────────────
    def scrape_deals(self) -> list[RawDeal]:
        if not self.scraperapi_key:
            logger.error(
                "SCRAPERAPI_KEY missing. Add it to Render Dashboard → Environment. "
                "Without it, Meesho blocks all cloud datacenter IPs."
            )

        logger.info("Meesho scraper v6 (circuit-breaker proxy + JSON API) starting...")
        logger.info(f"ScraperAPI key: {'SET (' + self.scraperapi_key[:8] + '...)' if self.scraperapi_key else 'MISSING — will try direct'}")

        # ── Check credits before burning a run ─────────────────────────
        remaining_credits = self._check_scraperapi_credits()
        if remaining_credits is not None and remaining_credits < 50:
            logger.error(
                f"ScraperAPI credits exhausted ({remaining_credits} left) — "
                "skipping proxy entirely, trying direct mode."
            )
            # Skip proxy, go straight to direct
            all_deals: list[RawDeal] = []
            for cat_slug, query in CATEGORY_QUERIES.items():
                cat_deals = self._scrape_category(query, cat_slug, proxies=None)
                all_deals.extend(cat_deals)
                logger.info(f"Meesho direct [{cat_slug}]: {len(cat_deals)} deals")
                time.sleep(1)
            logger.info(f"Meesho direct total: {len(all_deals)} deals")
            return all_deals

        proxies = None
        if self.scraperapi_key:
            proxy_url = f"http://scraperapi:{self.scraperapi_key}@proxy-server.scraperapi.com:8001"
            proxies = {
                "http":  proxy_url,
                "https": proxy_url,
            }

        all_deals: list[RawDeal] = []
        use_proxy = proxies is not None

        # ── Circuit-breaker: probe with first category before full run ────
        if use_proxy:
            probe_cat, probe_query = next(iter(CATEGORY_QUERIES.items()))
            probe_deals = self._scrape_category(probe_query, probe_cat, proxies)
            if probe_deals:
                logger.info(f"Meesho proxy OK ({len(probe_deals)} deals on probe — running full scrape)")
                all_deals.extend(probe_deals)
            else:
                logger.warning(
                    "Meesho proxy probe returned 0 — ScraperAPI credits likely exhausted "
                    "or Meesho API changed. Switching to DIRECT mode immediately."
                )
                use_proxy = False
                proxies   = None

        # ── Full scrape across all categories ────────────────────────
        for cat_slug, query in CATEGORY_QUERIES.items():
            # Skip the probe category if proxy succeeded (already scraped)
            if use_proxy and cat_slug == next(iter(CATEGORY_QUERIES)):
                continue
            cat_deals = self._scrape_category(query, cat_slug, proxies)
            all_deals.extend(cat_deals)
            logger.info(f"Meesho [{cat_slug}]: {len(cat_deals)} deals")
            time.sleep(1)   # Small delay between categories

        logger.info(f"Meesho total: {len(all_deals)} deals")
        return all_deals

    # ─────────────────────────────────────────────────────────────
    def _scrape_category(self, query: str, cat_slug: str, proxies) -> list[RawDeal]:
        all_deals: list[RawDeal] = []
        cursor = None

        # Tune aggressiveness based on whether we're going through a proxy.
        # Direct mode (no proxy on Render) almost always fails — fail fast.
        max_retries = 2 if proxies else 1
        req_timeout = 25 if proxies else 12

        for page in range(1, 3):   # Up to 2 pages per category (credit budget: 24 req/run)
            for attempt in range(1, max_retries + 1):
                try:
                    payload = {
                        "query":         query,
                        "type":          "text_search",
                        "page":          page,
                        "offset":        (page - 1) * 20,
                        "limit":         20,
                        "cursor":        cursor,
                        "isDevicePhone": False,
                    }
                    # We use curl_cffi from BaseScraper (self.get_curl_session()) to bypass TLS fingerprinting
                    resp = self.get_curl_session().post(
                        MEESHO_SEARCH_API,
                        json=payload,
                        headers=BASE_HEADERS,
                        proxies=proxies,
                        timeout=req_timeout,
                        verify=False,
                    )
                    logger.info(
                        f"Meesho [{cat_slug}] p{page} attempt {attempt}: "
                        f"HTTP {resp.status_code} ({len(resp.text)} chars)"
                    )

                    if resp.status_code == 200:
                        data     = resp.json()
                        catalogs = data.get("catalogs", [])
                        if not catalogs:
                            return all_deals   # No more pages
                        cursor = data.get("cursor")
                        for catalog in catalogs:
                            deal = self._catalog_to_deal(catalog, cat_slug)
                            if deal:
                                all_deals.append(deal)
                        break   # Success — move to next page
                    else:
                        logger.info(f"Meesho API non-200 ({resp.status_code}) for [{cat_slug}] p{page} — {'retry' if attempt < max_retries else 'giving up'}")
                        if attempt < max_retries:
                            time.sleep(2 * attempt)

                except Exception as e:
                    logger.debug(f"Meesho [{cat_slug}] p{page} attempt {attempt} error: {e}")
                    if attempt < 3:
                        time.sleep(2 * attempt)

        return all_deals

    # ─────────────────────────────────────────────────────────────
    def _catalog_to_deal(self, catalog: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = (
                catalog.get("hero_product_name")
                or catalog.get("name")
                or ""
            ).strip()
            if not title:
                return None

            disc_price = float(
                catalog.get("min_product_price")
                or catalog.get("min_catalog_price")
                or 0
            )
            orig_price = float(
                catalog.get("max_catalog_price")
                or disc_price * DEFAULT_DISCOUNT_FACTOR
            )

            if disc_price <= 0 or orig_price <= disc_price:
                return None

            # Build product URL
            slug       = catalog.get("slug") or catalog.get("original_slug") or ""
            catalog_id = catalog.get("id") or catalog.get("catalogId") or ""
            product_id = catalog.get("product_id", "")

            if slug and catalog_id:
                raw_url = f"https://www.meesho.com/{slug}/p/{catalog_id}"
            elif product_id:
                raw_url = f"https://www.meesho.com/s/p/{product_id}"
            else:
                return None

            product_url = f"{raw_url}?aid={self.affiliate_tag}" if self.affiliate_tag else raw_url

            # Image
            image_url = catalog.get("image", "")
            if not image_url:
                imgs = catalog.get("product_images") or []
                if imgs:
                    first     = imgs[0]
                    image_url = first.get("url", "") if isinstance(first, dict) else str(first)

            # Rating
            rating       = float(catalog.get("rating") or 0)
            rating_count = int(catalog.get("rating_count") or catalog.get("ratingCount") or 0)

            return RawDeal(
                title=title[:200],
                platform="meesho",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
                rating=rating,
                rating_count=rating_count,
            )

        except Exception as e:
            logger.debug(f"Meesho catalog parse error: {e}")
            return None


# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MeeshoScraper()
    results = s.scrape_deals()
    print(f"\nTotal deals: {len(results)}")
    for r in results[:8]:
        pct = int((1 - r.discounted_price / r.original_price) * 100)
        print(
            f"[{r.category}] {r.title[:55]:<55} "
            f"Rs.{r.discounted_price:>6.0f}  (was Rs.{r.original_price:.0f}, -{pct}%)"
        )
