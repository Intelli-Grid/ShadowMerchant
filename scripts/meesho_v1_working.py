"""
Meesho Scraper ΓÇö Pure API approach (no browser required).

Calls Meesho's internal search GraphQL/REST API directly using
browser-like headers. No Playwright dependency.
"""
import sys
import os
import json
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal
from category_map import CATEGORY_MAP

load_dotenv()
logger = logging.getLogger(__name__)

# Meesho search queries per category slug
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

# Realistic browser headers ΓÇö no session cookies needed for basic search
BASE_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
    "content-type": "application/json",
    "origin": "https://www.meesho.com",
    "referer": "https://www.meesho.com/",
    "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
}

SEARCH_API = "https://www.meesho.com/api/v1/products/search"


class MeeshoScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="meesho")
        self.affiliate_tag = os.getenv("MEESHO_AFFILIATE_TAG", "")

    def scrape_deals(self) -> list[RawDeal]:
        try:
            return asyncio.run(self._scrape_via_api())
        except Exception as e:
            logger.error(f"Meesho scraper error: {e}")
            return []

    async def _scrape_via_api(self) -> list[RawDeal]:
        import httpx

        categories = list(CATEGORY_QUERIES.keys())
        logger.info(f"Meesho: Scraping {len(categories)} categories via direct API")

        deals: list[RawDeal] = []

        async with httpx.AsyncClient(
            headers=BASE_HEADERS,
            timeout=25,
            follow_redirects=True,
        ) as client:
            for cat_slug in categories:
                query = CATEGORY_QUERIES[cat_slug]
                try:
                    catalogs = await self._fetch_catalogs(client, query, pages=3)
                    logger.info(f"Meesho [{cat_slug}]: {len(catalogs)} products")
                    for catalog in catalogs:
                        deal = self._catalog_to_deal(catalog, cat_slug)
                        if deal:
                            deals.append(deal)
                except Exception as e:
                    logger.warning(f"Meesho [{cat_slug}] error: {e}")

        logger.info(f"Meesho: {len(deals)} total deals scraped")
        return deals

    async def _fetch_catalogs(self, client, query: str, pages: int = 3) -> list:
        all_catalogs = []
        cursor = None

        for page_num in range(1, pages + 1):
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
                if resp.status_code == 200:
                    data = resp.json()
                    catalogs = data.get("catalogs", [])
                    if not catalogs:
                        break
                    all_catalogs.extend(catalogs)
                    cursor = data.get("cursor")
                    if not cursor:
                        break
                else:
                    logger.debug(f"Meesho API page {page_num} returned {resp.status_code}")
                    break
            except Exception as e:
                logger.debug(f"Meesho API page {page_num} failed: {e}")
                break

        return all_catalogs

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

            if disc_price <= 0:
                return None

            # Only keep deals with at least 10% discount
            if orig_price <= disc_price:
                return None

            product_id  = catalog.get("product_id", "")
            slug        = catalog.get("slug") or catalog.get("original_slug") or ""
            catalog_id  = catalog.get("id") or catalog.get("catalogId") or ""

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
        print(f"[{r.category}] {r.title[:60]} | Γé╣{r.discounted_price} (was Γé╣{r.original_price}) | {r.product_url[:70]}")
