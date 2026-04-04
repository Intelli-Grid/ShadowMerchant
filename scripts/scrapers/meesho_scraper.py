"""
Meesho Scraper — httpx via ScraperAPI residential proxy.

Meesho blocks cloud server IPs (Render, AWS, etc.) so we route through
ScraperAPI which provides residential IP rotation automatically.

Free tier: 5,000 requests/month — fits well within our 2x/day schedule.
Sign up: https://scraperapi.com (free, no credit card)
Set env var: SCRAPERAPI_KEY=your_key
"""
import sys
import os
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv()
logger = logging.getLogger(__name__)

CATEGORY_QUERIES = {
    "electronics":  "electronics",
    "fashion":      "women fashion clothing",
    "beauty":       "beauty skincare",
    "home":         "home decor kitchen",
    "sports":       "sports fitness",
    "books":        "books stationery",
    "toys":         "kids toys baby",
    "health":       "health wellness",
    "automotive":   "car bike accessories",
    "grocery":      "food grocery",
    "gaming":       "gaming accessories",
    "travel":       "travel bags luggage",
}

SEARCH_API = "https://www.meesho.com/api/v1/products/search"

BASE_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
    "content-type": "application/json",
    "origin": "https://www.meesho.com",
    "referer": "https://www.meesho.com/",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
}


class MeeshoScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="meesho")
        self.affiliate_tag   = os.getenv("MEESHO_AFFILIATE_TAG", "")
        self.scraperapi_key  = os.getenv("SCRAPERAPI_KEY", "")

    def _get_proxy_url(self) -> str | None:
        """Return ScraperAPI proxy URL if key is configured, else None."""
        if self.scraperapi_key:
            # ScraperAPI acts as a rotating residential proxy
            return f"http://scraperapi:{self.scraperapi_key}@proxy-server.scraperapi.com:8001"
        return None

    def scrape_deals(self) -> list[RawDeal]:
        if not self.scraperapi_key:
            logger.warning(
                "Meesho: SCRAPERAPI_KEY not set — requests will likely 403. "
                "Sign up free at scraperapi.com and add SCRAPERAPI_KEY to env vars."
            )
        try:
            return asyncio.run(self._scrape_async())
        except Exception as e:
            logger.error(f"Meesho scraper error: {e}")
            return []

    async def _scrape_async(self) -> list[RawDeal]:
        import httpx

        proxy_url = self._get_proxy_url()
        proxy_cfg = {"http://": proxy_url, "https://": proxy_url} if proxy_url else None

        if proxy_url:
            logger.info("Meesho: using ScraperAPI residential proxy")
        else:
            logger.info("Meesho: no proxy configured (direct request)")

        deals: list[RawDeal] = []

        # Use a single client for all categories (connection reuse)
        async with httpx.AsyncClient(
            headers=BASE_HEADERS,
            timeout=30,
            follow_redirects=True,
            proxies=proxy_cfg,
            verify=False,        # ScraperAPI uses its own SSL cert
        ) as client:
            for cat_slug, query in CATEGORY_QUERIES.items():
                cat_deals = await self._fetch_category(client, query, cat_slug)
                deals.extend(cat_deals)
                logger.info(f"Meesho [{cat_slug}]: {len(cat_deals)} deals")
                await asyncio.sleep(0.3)  # polite delay between categories

        logger.info(f"Meesho: {len(deals)} total deals scraped")
        return deals

    async def _fetch_category(self, client, query: str, cat_slug: str) -> list[RawDeal]:
        all_deals = []
        cursor = None

        for page_num in range(1, 4):  # 3 pages per category
            payload = {
                "query": query,
                "type": "text_search",
                "page": page_num,
                "offset": (page_num - 1) * 20,
                "limit": 20,
                "cursor": cursor,
                "isDevicePhone": False,
            }
            try:
                resp = await client.post(SEARCH_API, json=payload)
                if resp.status_code != 200:
                    logger.debug(f"Meesho [{cat_slug}] p{page_num}: HTTP {resp.status_code}")
                    break

                data = resp.json()
                catalogs = data.get("catalogs", [])
                if not catalogs:
                    break

                for catalog in catalogs:
                    deal = self._catalog_to_deal(catalog, cat_slug)
                    if deal:
                        all_deals.append(deal)

                cursor = data.get("cursor")
                if not cursor:
                    break

            except Exception as e:
                logger.debug(f"Meesho [{cat_slug}] p{page_num}: {e}")
                break

        return all_deals

    def _catalog_to_deal(self, catalog: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = (
                catalog.get("hero_product_name")
                or catalog.get("name")
                or ""
            ).strip()
            if not title:
                return None

            disc_price = float(catalog.get("min_product_price") or catalog.get("min_catalog_price") or 0)
            orig_price = float(catalog.get("max_catalog_price") or disc_price * 1.2)

            if disc_price <= 0 or orig_price <= disc_price:
                return None

            product_id = catalog.get("product_id", "")
            slug       = catalog.get("slug") or catalog.get("original_slug") or ""
            catalog_id = catalog.get("id") or catalog.get("catalogId") or ""

            if slug and catalog_id:
                raw_url = f"https://www.meesho.com/{slug}/p/{catalog_id}"
            elif product_id:
                raw_url = f"https://www.meesho.com/s/p/{product_id}"
            else:
                return None

            product_url = f"{raw_url}?aid={self.affiliate_tag}" if self.affiliate_tag else raw_url

            image_url = catalog.get("image", "")
            if not image_url:
                imgs = catalog.get("product_images") or []
                if imgs:
                    first = imgs[0]
                    image_url = first.get("url", "") if isinstance(first, dict) else str(first)

            return RawDeal(
                title=title[:200],
                platform="meesho",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
            )
        except Exception as e:
            logger.debug(f"Meesho catalog parse error: {e}")
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MeeshoScraper()
    results = s.scrape_deals()
    print(f"\nTotal deals: {len(results)}")
    for r in results[:6]:
        print(f"[{r.category}] {r.title[:60]} | Rs.{r.discounted_price} (was Rs.{r.original_price})")
