"""
Nykaa Scraper — Pure httpx, no browser session required.
Calls Nykaa's internal search API directly with static headers.
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

# Nykaa category definitions (id, name, slug)
NYKAA_CATEGORIES = {
    "beauty": [
        ("54",   "Makeup"),
        ("53",   "Skin Care"),
        ("55",   "Hair Care"),
        ("56",   "Bath and Body"),
        ("1026", "Fragrances"),
    ],
    "health": [
        ("5267", "Wellness"),
        ("4992", "Nutrition"),
    ],
    "fashion": [
        ("6", "Fashion"),
    ],
}

BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nykaa.com/",
    "Origin": "https://www.nykaa.com",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}


class NykaaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="nykaa")
        self._cookies: dict = {}
        self._headers: dict = BASE_HEADERS.copy()

    def _bootstrap(self):
        logger.info("Nykaa: bootstrapping session...")
        try:
            cookies, headers = get_session("https://www.nykaa.com/beauty/c/3", wait_ms=4000)
            if cookies:
                self._cookies = cookies
                self._headers.update(headers)
                self._headers["Accept"] = "application/json, text/plain, */*"
                logger.info(f"Nykaa: session ready — {len(self._cookies)} cookies")
            else:
                logger.warning("Nykaa: 0 cookies from bootstrap, proceeding without session")
        except Exception as e:
            logger.warning(f"Nykaa bootstrap error: {e}")


    def _fetch_category(self, cat_id: str, cat_name: str) -> list[dict]:
        """Try multiple Nykaa API endpoints for a category."""
        from curl_cffi import requests as cffi_requests
        # Method 1: Search API sorted by discount
        try:
            resp = cffi_requests.get(
                "https://www.nykaa.com/sp/api/search",
                params={"q": cat_name, "page": 0, "ptype": "list", "sortBy": "discount", "f": "offer_available:True"},
                headers=self._headers,
                impersonate="chrome120",
                timeout=20,
            )
            if resp.status_code == 200:
                products = resp.json().get("response", {}).get("products", [])
                if products:
                    return products
        except Exception as e:
            logger.debug(f"Nykaa method1 [{cat_name}]: {e}")

        # Method 2: Category browse endpoint
        try:
            resp2 = cffi_requests.get(
                f"https://www.nykaa.com/beauty/c/{cat_id}",
                params={"sort": "discount", "ptype": "list"},
                headers={**self._headers, "Accept": "application/json"},
                impersonate="chrome120",
                timeout=20,
            )
            if resp2.status_code == 200 and "json" in resp2.headers.get("content-type", ""):
                return resp2.json().get("products", [])
        except Exception as e:
            logger.debug(f"Nykaa method2 [{cat_name}]: {e}")

        # Method 3: Newer API format
        try:
            resp3 = cffi_requests.get(
                "https://www.nykaa.com/api/product/products/",
                params={"rootCat": cat_id, "category": cat_id, "sortBy": "discount"},
                headers=self._headers,
                impersonate="chrome120",
                timeout=20,
            )
            if resp3.status_code == 200:
                data = resp3.json()
                return data.get("products", data.get("data", {}).get("products", []))
        except Exception as e:
            logger.debug(f"Nykaa method3 [{cat_name}]: {e}")

        return []

    def scrape_deals(self) -> list[RawDeal]:
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

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = p.get("name") or p.get("productName") or p.get("title", "")
            if not title:
                return None

            disc_price = float(
                p.get("discounted_price") or p.get("price")
                or p.get("sellingPrice") or p.get("offer_price", 0) or 0
            )
            orig_price = float(
                p.get("mrp") or p.get("originalPrice")
                or p.get("listingPrice") or disc_price
            )
            if disc_price <= 0:
                return None

            slug = p.get("slug") or p.get("url") or p.get("productUrl") or ""
            product_url = (
                f"https://www.nykaa.com/{slug}"
                if slug and not slug.startswith("http") else slug
            )
            if not product_url:
                return None

            image_url = (
                p.get("imageUrl") or p.get("image")
                or (p.get("images", [""]) or [""])[0] or ""
            )

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
            logger.debug(f"Nykaa parse error: {e}")
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = NykaaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} (was ₹{r.original_price})")
