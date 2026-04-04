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
    def scrape_deals(self) -> list[RawDeal]:
        logger.info("Meesho scraper v5 (ScraperAPI residential proxy + JSON API) starting...")
        logger.info(f"ScraperAPI key: {'SET (' + self.scraperapi_key[:8] + '...)' if self.scraperapi_key else 'MISSING'}")

        proxies = None
        if self.scraperapi_key:
            proxies = {
                "http":  SCRAPERAPI_PROXY,
                "https": SCRAPERAPI_PROXY,
            }

        all_deals: list[RawDeal] = []

        for cat_slug, query in CATEGORY_QUERIES.items():
            cat_deals = self._scrape_category(query, cat_slug, proxies)
            all_deals.extend(cat_deals)
            logger.info(f"Meesho [{cat_slug}]: {len(cat_deals)} deals")
            time.sleep(1)   # Small delay between categories

        logger.info(f"Meesho total: {len(all_deals)} deals")

        # If proxy gave 0 results, try direct (Render's IP might be ok for API)
        if not all_deals:
            logger.warning("Proxy returned 0 deals — retrying direct (no proxy)...")
            for cat_slug, query in CATEGORY_QUERIES.items():
                cat_deals = self._scrape_category(query, cat_slug, proxies=None)
                all_deals.extend(cat_deals)
                if cat_deals:
                    logger.info(f"Meesho direct [{cat_slug}]: {len(cat_deals)} deals")
                time.sleep(1)
            logger.info(f"Meesho direct total: {len(all_deals)} deals")

        return all_deals

    # ─────────────────────────────────────────────────────────────
    def _scrape_category(self, query: str, cat_slug: str, proxies) -> list[RawDeal]:
        all_deals: list[RawDeal] = []
        cursor = None

        for page in range(1, 4):   # Up to 3 pages per category
            for attempt in range(1, 4):   # Up to 3 retries per page
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
                    resp = requests.post(
                        MEESHO_SEARCH_API,
                        json=payload,
                        headers=BASE_HEADERS,
                        proxies=proxies,
                        auth=HTTPProxyAuth("scraperapi", self.scraperapi_key) if proxies else None,
                        timeout=30,
                        verify=False,
                    )
                    logger.debug(
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
                        logger.debug(f"Meesho API returned {resp.status_code} for {cat_slug} p{page}")
                        if attempt < 3:
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
