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
        self._cookies: dict = {}
        self._headers: dict = SEARCH_HEADERS.copy()

    def _bootstrap(self):
        """Get session cookies from Flipkart via stealth browser."""
        logger.info("Flipkart: bootstrapping session...")
        try:
            cookies, headers = get_session("https://www.flipkart.com", wait_ms=4000)
            if cookies:
                self._cookies = cookies
                self._headers.update(headers)
                self._headers["Accept"] = "application/json"
                self._headers["X-User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FKUA/website/42/website/Desktop"
                logger.info(f"Flipkart: session ready — {len(self._cookies)} cookies")
            else:
                logger.warning("Flipkart: 0 cookies from bootstrap, trying without session")
        except Exception as e:
            logger.warning(f"Flipkart bootstrap error: {e}, proceeding without session")


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
        """Call Flipkart internal page API then fall back to HTML scrape."""
        SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "")
        proxies = None
        if SCRAPERAPI_KEY:
            proxy_url = f"http://scraperapi:{SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001"
            proxies = {"http://": proxy_url, "https://": proxy_url}

        # Method 1: Internal page API
        try:
            resp = httpx.post(
                "https://www.flipkart.com/api/4/page.getPage/dynamic",
                json={
                    "pageUri": f"/search?q={query}&sort=popularity&page=1",
                    "requestContext": {"slug": "search"},
                },
                headers=SEARCH_HEADERS,
                proxies=proxies,
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code == 200:
                data = resp.json()
                products = []
                for slot in data.get("pageData", {}).get("page", {}).get("slots", []):
                    for item in slot.get("widget", {}).get("data", {}).get("products", []):
                        products.append(item)
                if products:
                    return products
        except Exception as e:
            logger.debug(f"Flipkart API method1 error: {e}")

        # Method 2: HTML search page — extract __INITIAL_STATE__ JSON blob
        import re, json
        try:
            resp2 = httpx.get(
                f"https://www.flipkart.com/search?q={query}&sort=popularity",
                headers=BASE_HEADERS,
                proxies=proxies,
                timeout=20,
                follow_redirects=True,
            )
            if resp2.status_code == 200:
                match = re.search(
                    r'window\.__INITIAL_STATE__\s*=\s*({.*?});\s*</script>',
                    resp2.text, re.DOTALL
                )
                if match:
                    state = json.loads(match.group(1))
                    results = []
                    for val in state.values():
                        if isinstance(val, dict) and "products" in val:
                            results.extend(val["products"])
                    if results:
                        return results

                # Method 3: Extract JSON data from script tags
                matches = re.findall(r'"productName"\s*:\s*"([^"]+)"', resp2.text)
                if matches:
                    logger.debug(f"Flipkart HTML found {len(matches)} product names in page")
        except Exception as e:
            logger.debug(f"Flipkart HTML fallback error: {e}")

        return []

    def scrape_deals(self) -> list[RawDeal]:
        self._bootstrap()
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
            title = (
                p.get("productName") or p.get("title") or p.get("name")
                or (p.get("titleInfo") or {}).get("title", "")
            ).strip()
            if not title:
                return None

            pricing = p.get("priceInfo") or p.get("pricing") or {}
            disc_price = float(
                (pricing.get("finalPrice") or {}).get("value", 0)
                or pricing.get("price", 0)
                or p.get("discountedPrice", 0) or 0
            )
            orig_price = float(
                (pricing.get("mrp") or {}).get("value", 0)
                or (pricing.get("mrp") if isinstance(pricing.get("mrp"), (int, float)) else 0)
                or p.get("mrp", disc_price) or disc_price
            )
            if disc_price <= 0:
                return None

            pid  = p.get("productId") or p.get("id") or ""
            slug = p.get("slug") or p.get("productUrl") or ""
            product_url = self._build_stable_url(slug, pid)

            images = p.get("imageInfo") or {}
            image_url = images.get("primaryImage") or p.get("image") or ""

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
