import sys
import os
import logging
import httpx
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv()
logger = logging.getLogger(__name__)

AFFILIATE_TAG = os.getenv("FLIPKART_AFFILIATE_TAG", "")

CATEGORY_QUERIES = {
    "electronics":  "electronics",
    "fashion":      "clothing",
    "beauty":       "beauty and personal care",
    "home":         "home and kitchen",
    "sports":       "sports and fitness",
    "books":        "books",
    "toys":         "toys and baby products",
    "health":       "health and wellness",
    "automotive":   "automotive",
    "grocery":      "grocery",
    "travel":       "bags wallets luggage",
    "gaming":       "gaming",
}

BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection": "keep-alive",
}

SEARCH_HEADERS = {
    **BASE_HEADERS,
    "Accept": "application/json",
    "X-User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FKUA/website/42/website/Desktop",
    "Referer": "https://www.flipkart.com/",
}

class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="flipkart")
        self.affiliate_tag = AFFILIATE_TAG


    def _build_stable_url(self, slug: str, pid: str) -> str:
        if not pid and not slug:
            return ""
        from urllib.parse import urlparse, parse_qs
        if slug:
            full = f"https://www.flipkart.com{slug}" if slug.startswith("/") else slug
            try:
                qs = parse_qs(urlparse(full).query)
                pid = qs.get("pid", [pid])[0] if not pid else pid
                path = urlparse(full).path
            except Exception:
                path = "/product/p/iteme"
        else:
            path = "/product/p/iteme"

        if not pid:
            return ""
        url = f"https://www.flipkart.com{path}?pid={pid}"
        if self.affiliate_tag:
            url += f"&affid={self.affiliate_tag}"
        return url

    def _search(self, query: str) -> list[dict]:
        from curl_cffi import requests
        import re
        import json
        
        try:
            resp = requests.get(
                f"https://www.flipkart.com/search?q={query}&sort=popularity",
                headers=BASE_HEADERS,
                impersonate="chrome120",
                timeout=20,
            )
            if resp.status_code == 200:
                match = re.search(
                    r'window\.__INITIAL_STATE__\s*=\s*({.*?});\s*</script>',
                    resp.text, re.DOTALL
                )
                if match:
                    state = json.loads(match.group(1))
                    
                    def find_products(obj, depth=0):
                        prods = []
                        if depth > 15:  # Prevent infinite recursion on deeply nested objects
                            return prods
                        if isinstance(obj, dict):
                            # Flipkart's current __INITIAL_STATE__ structure (April 2026)
                            # Products are nested under slots → widget → data → products
                            if "productInfo" in obj and isinstance(obj.get("productInfo"), dict):
                                pinfo = obj["productInfo"].get("value", {})
                                if pinfo and isinstance(pinfo, dict):
                                    prods.append(pinfo)
                            # Also check for direct product arrays
                            if "products" in obj and isinstance(obj["products"], list):
                                prods.extend(obj["products"])
                            # Recurse into all dict values
                            for v in obj.values():
                                if isinstance(v, (dict, list)):
                                    prods.extend(find_products(v, depth + 1))
                        elif isinstance(obj, list):
                            for item in obj:
                                if isinstance(item, (dict, list)):
                                    prods.extend(find_products(item, depth + 1))
                        return prods
                        
                    results = find_products(state)
                    if results:
                        return results
                        
            logger.debug(f"Flipkart HTML [{query}]: HTTP {resp.status_code}")
        except Exception as e:
            logger.debug(f"Flipkart HTML error: {e}")

        return []

    def scrape_deals(self) -> list[RawDeal]:
        deals = []

        for cat_slug, query in CATEGORY_QUERIES.items():
            try:
                products = self._search(query)
                logger.info(f"Flipkart [{cat_slug}]: {len(products)} products")
                for p in products[:20]:
                    deal = self._product_to_deal(p, cat_slug)
                    if deal:
                        deals.append(deal)
            except Exception as e:
                logger.error(f"Flipkart [{cat_slug}] error: {e}")

        logger.info(f"Flipkart: {len(deals)} deals scraped")
        return deals

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            titles = p.get("titles", {})
            title = (
                titles.get("title") or titles.get("newTitle") or
                p.get("productName") or p.get("title") or p.get("name")
            )
            if not title:
                return None
            title = title.strip()

            pricing = p.get("pricing", {})
            prices = pricing.get("prices", [])
            
            disc_price = 0
            orig_price = 0
            
            for pr in prices:
                ptype = pr.get("priceType", "")
                val = float(pr.get("value", 0))
                if ptype == "SPECIAL_PRICE":
                    disc_price = val
                elif ptype == "FSP":
                    orig_price = val
                    
            if not disc_price:
                disc_price = float(p.get("discountedPrice", 0) or 0)
            if not orig_price:
                orig_price = float(p.get("mrp", disc_price) or disc_price)
                
            if disc_price <= 0:
                return None

            pid  = p.get("id") or p.get("productId") or ""
            slug = p.get("baseUrl") or p.get("slug") or p.get("productUrl") or ""
            product_url = self._build_stable_url(slug, pid)

            images = p.get("media", {}).get("images", [])
            image_url = ""
            if images:
                image_url = images[0].get("url", "")
                image_url = image_url.replace("{@width}", "800").replace("{@height}", "800").replace("{@quality}", "70")
            if not image_url:
                image_url = p.get("image", "")

            return RawDeal(
                title=title[:200],
                platform="flipkart",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
            )
        except Exception as e:
            logger.debug(f"Flipkart parse error: {e}")
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = FlipkartScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price}")
