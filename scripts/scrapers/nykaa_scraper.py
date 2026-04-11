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
        # HTML fetch doesn't need stealth cookies because curl_cffi covers fingerprint
        pass


    def _fetch_category(self, cat_name: str) -> list[dict]:
        from curl_cffi import requests as cffi_requests
        import re, json
        try:
            resp = cffi_requests.get(
                f"https://www.nykaa.com/search/result/?q={cat_name}",
                headers=BASE_HEADERS,
                impersonate="chrome120",
                timeout=20,
            )
            if resp.status_code == 200:
                match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*(.*?)</script>', resp.text, re.DOTALL)
                if match:
                    blob = match.group(1).strip()
                    if blob.endswith(";"):
                        blob = blob[:-1]
                    state = json.loads(blob)
                    
                    # Nykaa puts products in categoryListing or desktop search
                    products = []
                    cl_products = state.get("categoryListing", {}).get("listingData", {}).get("products", [])
                    if cl_products:
                        products.extend(cl_products)
                    
                    sl_products = state.get("searchListingPage", {}).get("listingData", {}).get("products", [])
                    if sl_products:
                        products.extend(sl_products)
                    
                    # Deduplicate based on name or id
                    seen = set()
                    unique_results = []
                    for r in products:
                        title = r.get("name") or r.get("title") or ""
                        if title and title not in seen:
                            seen.add(title)
                            unique_results.append(r)
                            
                    return unique_results
            logger.debug(f"Nykaa HTML HTTP {resp.status_code}")
        except Exception as e:
            logger.debug(f"Nykaa fetch error: {e}")
            
        return []

    def scrape_deals(self) -> list[RawDeal]:
        self._bootstrap()
        deals = []
        for cat_slug, category_list in NYKAA_CATEGORIES.items():
            for cat_id, cat_name in category_list:
                try:
                    products = self._fetch_category(cat_name)
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
