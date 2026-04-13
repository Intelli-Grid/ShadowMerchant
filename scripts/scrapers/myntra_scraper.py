"""
Myntra Scraper — curl_cffi + Gateway v2 JSON API.
Calls Myntra's internal product list API directly, avoiding fragile HTML regex parsing.
Falls back to HTML scraping if API returns no results.
"""
import sys
import os
import logging
import json
import re
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

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
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://www.myntra.com/",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "X-Myntra-Abtest": "pdp_glance:true",
}

# Myntra's internal product list Gateway API — stable JSON response
GATEWAY_API = "https://www.myntra.com/gateway/v2/product/list/filter/json"


class MyntraScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="myntra")
        self._cookies: dict = {}
        self._headers: dict = BASE_HEADERS.copy()

    def _search_via_api(self, query: str) -> list[dict]:
        """Primary: call Myntra's Gateway v2 JSON API directly."""
        from curl_cffi import requests as cffi_requests
        try:
            params = {
                "category": query,
                "pageNo": 1,
                "pageSize": 50,
                "plaEnabled": False,
            }
            resp = cffi_requests.get(
                GATEWAY_API,
                params=params,
                headers=BASE_HEADERS,
                impersonate="chrome124",
                timeout=25,
            )
            if resp.status_code == 200:
                data = resp.json()
                products = (
                    data.get("products", [])
                    or data.get("searchData", {}).get("results", {}).get("products", [])
                )
                if products:
                    logger.debug(f"Myntra API [{query}]: {len(products)} products")
                    return products
            logger.debug(f"Myntra API [{query}]: HTTP {resp.status_code} — no products")
        except Exception as e:
            logger.debug(f"Myntra API [{query}] error: {e}")
        return []

    def _search_via_html(self, query: str) -> list[dict]:
        """Fallback: HTML scrape with multi-pattern regex on page state variables."""
        from curl_cffi import requests as cffi_requests
        url = f"https://www.myntra.com/{query}"
        params = {"p": 1, "sort": "popularity_desc"}
        try:
            resp = cffi_requests.get(
                url, params=params,
                headers=BASE_HEADERS,
                impersonate="chrome124",
                timeout=25,
            )
            if resp.status_code == 200:
                for pattern in [
                    r'window\.__myx\s*=\s*(.*?)\s*</script>',
                    r'window\.__INITIAL_STATE__\s*=\s*(.*?)\s*</script>',
                    r'window\.initialData\s*=\s*(.*?)\s*</script>',
                    r'window\.__DATA__\s*=\s*(.*?)\s*</script>',
                    r'"products"\s*:\s*(\[.*?\])\s*[,}]',
                ]:
                    match = re.search(pattern, resp.text, re.DOTALL)
                    if match:
                        blob = match.group(1).strip().rstrip(';')
                        try:
                            data = json.loads(blob)
                            # If the match was the products array directly
                            if isinstance(data, list):
                                if data:
                                    logger.debug(f"Myntra HTML [{query}]: {len(data)} products via direct array")
                                    return data
                            else:
                                products = (
                                    data.get("searchData", {}).get("results", {}).get("products", [])
                                    or data.get("pageData", {}).get("data", {}).get("products", [])
                                    or data.get("products", [])
                                )
                                if products:
                                    logger.debug(f"Myntra HTML [{query}]: {len(products)} products")
                                    return products
                        except json.JSONDecodeError:
                            continue
            logger.debug(f"Myntra HTML [{query}]: HTTP {resp.status_code} — no products found")
        except Exception as e:
            logger.debug(f"Myntra HTML [{query}] error: {e}")
        return []

    def _search(self, query: str) -> list[dict]:
        """Try Gateway API first, fall back to HTML scraping."""
        products = self._search_via_api(query)
        if not products:
            logger.debug(f"Myntra [{query}]: API returned 0 — trying HTML fallback")
            products = self._search_via_html(query)
        return products

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
                or p.get("name", "")
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
