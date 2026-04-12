"""
Myntra Scraper — Pure httpx, no browser session required.
Calls Myntra's gateway search API directly with static headers.
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

AFFILIATE_TAG = os.getenv("MYNTRA_AFFILIATE_TAG", "")

CATEGORY_QUERIES = {
    "fashion":  ["women-dresses", "men-tshirts", "women-tops-tshirts", "men-shirts"],
    "beauty":   ["beauty", "skincare", "makeup"],
    "sports":   ["sports-shoes", "activewear"],
    "travel":   ["backpacks", "trolley-bags"],
    "home":     ["home-furnishing", "bedsheets"],
    "health":   ["fitness-equipment"],
}

BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://www.myntra.com/",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "X-Myntra-Abtest": "pdp_glance:true",
}


class MyntraScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="myntra")
        self._cookies: dict = {}
        self._headers: dict = BASE_HEADERS.copy()



    def _search(self, query: str) -> list[dict]:
        from curl_cffi import requests as cffi_requests
        import re
        import json
        url = f"https://www.myntra.com/{query}"
        params = {"p": 1, "sort": "popularity_desc"}
        api_key = os.getenv("SCRAPERAPI_KEY", "")
        proxies = None
        if api_key:
            proxy_url = f"http://scraperapi:{api_key}@proxy-server.scraperapi.com:8001"
            proxies = {"http": proxy_url, "https": proxy_url}

        try:
            resp = cffi_requests.get(
                url, params=params,
                headers=BASE_HEADERS,
                proxies=proxies,
                impersonate="chrome120",
                timeout=30,
            )
            if resp.status_code == 200:
                match = re.search(r'window\.__myx\s*=(.*?)</script>', resp.text)
                if match:
                    data_str = match.group(1).strip()
                    if data_str.endswith(";"):
                        data_str = data_str[:-1]
                    data = json.loads(data_str)
                    return (
                        data.get("searchData", {}).get("results", {}).get("products", [])
                        or data.get("products", []) or []
                    )
            logger.debug(f"Myntra HTML [{query}]: HTTP {resp.status_code}")
        except Exception as e:
            logger.debug(f"Myntra [{query}] error: {e}")
        return []

    def scrape_deals(self) -> list[RawDeal]:
        deals = []

        for cat_slug, queries in CATEGORY_QUERIES.items():
            for query in queries:
                try:
                    products = self._search(query)
                    logger.info(f"Myntra [{cat_slug}/{query}]: {len(products)} products")
                    for p in products[:15]:
                        deal = self._product_to_deal(p, cat_slug)
                        if deal:
                            deals.append(deal)
                except Exception as e:
                    logger.error(f"Myntra [{cat_slug}] error: {e}")

        logger.info(f"Myntra: {len(deals)} deals scraped")
        return deals

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = (
                ((p.get("product") or "") + " " + (p.get("brand") or "")).strip()
                or p.get("productName", "")
            )
            if not title:
                return None

            price_info = p.get("price", {}) or {}
            if isinstance(price_info, dict):
                disc_price = float(
                    price_info.get("discounted", 0)
                    or p.get("discountedPrice", 0) or 0
                )
                orig_price = float(
                    price_info.get("mrp", 0)
                    or p.get("mrp", disc_price) or disc_price
                )
            else:
                disc_price = float(p.get("price", 0) or p.get("discountedPrice", 0) or 0)
                orig_price = float(p.get("mrp", disc_price) or disc_price)
                
            if disc_price <= 0:
                return None

            pid = p.get("productId") or p.get("id") or ""
            product_url = f"https://www.myntra.com/{pid}" if pid else ""
            if not product_url:
                return None

            images = p.get("images", [{}]) or [{}]
            first_img = images[0] if images else {}
            image_url = (
                first_img.get("src", "") if isinstance(first_img, dict) else str(first_img)
            ) or p.get("image", "")

            return RawDeal(
                title=title[:200],
                platform="myntra",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
            )
        except Exception as e:
            logger.debug(f"Myntra parse error: {e}")
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MyntraScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} (was ₹{r.original_price})")
