"""
Nykaa Scraper — httpx + stealth session bootstrap.
Uses Nykaa's internal search/category API with a valid session cookie.
"""
import sys
import os
import logging
import httpx
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal
from scrapers.session_bootstrap import get_session

load_dotenv()
logger = logging.getLogger(__name__)

# Nykaa category IDs (from their API)
NYKAA_CATEGORIES = {
    "beauty":  [
        ("54",  "Makeup"),
        ("53",  "Skin Care"),
        ("55",  "Hair Care"),
        ("56",  "Bath & Body"),
    ],
    "health":  [
        ("5267", "Wellness"),
    ],
    "fashion": [
        ("6",   "Fashion"),
    ],
}


class NykaaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="nykaa")
        self._cookies: dict = {}
        self._headers: dict = {}

    def _bootstrap(self):
        logger.info("Nykaa: bootstrapping session...")
        self._cookies, self._headers = get_session("https://www.nykaa.com/beauty/c/3", wait_ms=3000)
        self._headers.update({
            "Accept": "application/json, text/plain, */*",
            "X-Requested-With": "XMLHttpRequest",
        })
        logger.info(f"Nykaa: session ready — {len(self._cookies)} cookies")

    def _fetch_category(self, cat_id: str, cat_name: str) -> list[dict]:
        """Fetch products for a Nykaa category via their search API."""
        # Method 1: Category browse API
        url = f"https://www.nykaa.com/sp/api/search?q={cat_name}&page=0&ptype=list&sortBy=discount&f=offer_available%3ATrue"
        try:
            resp = httpx.get(url, headers=self._headers, cookies=self._cookies, timeout=15, follow_redirects=True)
            if resp.status_code == 200:
                data = resp.json()
                products = data.get("response", {}).get("products", [])
                if products:
                    return products
        except Exception as e:
            logger.debug(f"Nykaa method1 error: {e}")

        # Method 2: Category page API
        url2 = f"https://www.nykaa.com/beauty/c/{cat_id}?sort=discount&ptype=list"
        try:
            resp2 = httpx.get(url2, headers={**self._headers, "Accept": "application/json"},
                              cookies=self._cookies, timeout=15, follow_redirects=True)
            if resp2.status_code == 200 and "application/json" in resp2.headers.get("content-type", ""):
                return resp2.json().get("products", [])
        except Exception as e:
            logger.debug(f"Nykaa method2 error: {e}")

        return []

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = p.get("name") or p.get("productName") or p.get("title", "")
            if not title:
                return None

            disc_price = float(p.get("discounted_price") or p.get("price") or p.get("sellingPrice") or 0)
            orig_price = float(p.get("mrp") or p.get("originalPrice") or p.get("listingPrice") or disc_price)

            if disc_price <= 0:
                return None

            slug = p.get("slug") or p.get("url") or ""
            product_url = (
                f"https://www.nykaa.com/{slug}" if slug and not slug.startswith("http") else slug
            )
            image_url = p.get("imageUrl") or p.get("image") or p.get("images", [""])[0] or ""

            return RawDeal(
                title=title[:200],
                platform="nykaa",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
            )
        except Exception as e:
            logger.debug(f"Nykaa product parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        self._bootstrap()
        deals = []

        for cat_slug, category_list in NYKAA_CATEGORIES.items():
            for cat_id, cat_name in category_list:
                try:
                    products = self._fetch_category(cat_id, cat_name)
                    logger.info(f"Nykaa [{cat_slug}/{cat_name}]: {len(products)} products")
                    for p in products[:20]:
                        deal = self._product_to_deal(p, cat_slug)
                        if deal:
                            deals.append(deal)
                except Exception as e:
                    logger.error(f"Nykaa [{cat_slug}/{cat_name}] error: {e}")

        logger.info(f"Nykaa: {len(deals)} deals scraped")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = NykaaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | Rs.{r.discounted_price} | {r.discount_percent}% off")
