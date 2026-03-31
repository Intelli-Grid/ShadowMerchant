"""
Flipkart Scraper — httpx + stealth session bootstrap.
Uses Flipkart's internal search API (same XHR the website fires),
bootstrapped with a real session cookie from the homepage.
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

AFFILIATE_TAG = os.getenv("FLIPKART_AFFILIATE_TAG", "")

# Category → Flipkart internal category ID mapping (from their search API)
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


class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="flipkart")
        self.affiliate_tag = AFFILIATE_TAG
        self._cookies: dict = {}
        self._headers: dict = {}

    def _build_stable_url(self, slug: str, pid: str, affid: str) -> str:
        """
        Build a permanent Flipkart product URL.
        Flipkart stable format: https://www.flipkart.com/product/p/iteme?pid=XXXX
        Session-scoped slugs without a pid are discarded (return empty string).
        """
        if not slug and not pid:
            return ""

        from urllib.parse import urlparse, parse_qs, urlencode

        # If slug looks like a full URL or relative path, parse out the pid
        if slug:
            full = f"https://www.flipkart.com{slug}" if slug.startswith("/") else slug
            try:
                parsed = urlparse(full)
                qs = parse_qs(parsed.query)
                extracted_pid = qs.get("pid", [pid])[0] if not pid else pid
            except Exception:
                extracted_pid = pid
        else:
            full = ""
            extracted_pid = pid

        if not extracted_pid:
            # No pid means the URL is session-scoped and will break — discard it
            return ""

        # Reconstruct a clean, permanent product URL
        clean_path = urlparse(full).path if full else "/product/p/iteme"
        stable_url = f"https://www.flipkart.com{clean_path}?pid={extracted_pid}"
        if affid:
            stable_url += f"&affid={affid}"
        return stable_url

    def _bootstrap(self):
        """Harvest session cookies from Flipkart homepage via stealth browser."""
        logger.info("Flipkart: bootstrapping session...")
        self._cookies, self._headers = get_session("https://www.flipkart.com", wait_ms=3000)
        self._headers.update({
            "Accept": "application/json",
            "X-User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FKUA/website/42/website/Desktop",
        })
        logger.info(f"Flipkart: session ready — {len(self._cookies)} cookies")

    def _search_api(self, query: str, page: int = 1) -> list[dict]:
        """Call Flipkart's internal search endpoint and return raw product list."""
        url = "https://www.flipkart.com/api/4/page.getPage/dynamic"
        try:
            resp = httpx.post(
                url,
                json={
                    "pageUri": f"/search?q={query}&sort=popularity&p=1&page={page}",
                    "requestContext": {"slug": "search"},
                },
                headers=self._headers,
                cookies=self._cookies,
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code == 200:
                data = resp.json()
                # Drill into the nested pageData → pageComponent → widgetData
                page_data = data.get("pageData", {})
                slots = page_data.get("page", {}).get("slots", [])
                products = []
                for slot in slots:
                    widget = slot.get("widget", {})
                    for item in widget.get("data", {}).get("products", []):
                        products.append(item)
                return products
        except Exception as e:
            logger.debug(f"Flipkart search API error: {e}")

        # Fallback: simple search URL scrape using requests session
        return self._search_html_fallback(query)

    def _search_html_fallback(self, query: str) -> list[dict]:
        """Fallback method using plain HTTP GET + JSON extraction from page source."""
        import re, json
        url = f"https://www.flipkart.com/search?q={query}&sort=popularity"
        try:
            resp = httpx.get(
                url,
                headers=self._headers,
                cookies=self._cookies,
                timeout=15,
                follow_redirects=True,
            )
            # Flipkart embeds a window.__INITIAL_STATE__ JSON in the HTML
            match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?});', resp.text, re.DOTALL)
            if match:
                state = json.loads(match.group(1))
                # Navigate into the search results
                results = []
                for key, val in state.items():
                    if isinstance(val, dict) and "products" in val:
                        results.extend(val["products"])
                return results
        except Exception as e:
            logger.debug(f"Flipkart HTML fallback error: {e}")
        return []

    def scrape_deals(self) -> list[RawDeal]:
        self._bootstrap()
        deals = []

        for cat_slug, query in CATEGORY_QUERIES.items():
            try:
                raw_products = self._search_api(query)
                logger.info(f"Flipkart [{cat_slug}]: {len(raw_products)} raw products")
                for p in raw_products[:20]:
                    deal = self._product_to_deal(p, cat_slug)
                    if deal:
                        deals.append(deal)
            except Exception as e:
                logger.error(f"Flipkart [{cat_slug}] error: {e}")

        logger.info(f"Flipkart: {len(deals)} deals scraped")
        return deals

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            # Flipkart's product dicts vary by API version; try multiple paths
            title = (
                p.get("productName")
                or p.get("title")
                or p.get("name")
                or (p.get("titleInfo", {}) or {}).get("title", "")
            ).strip()
            if not title:
                return None

            pricing = p.get("priceInfo", {}) or p.get("pricing", {}) or {}
            disc_price = float(
                pricing.get("finalPrice", {}).get("value", 0)
                or pricing.get("price", 0)
                or p.get("discountedPrice", 0)
                or 0
            )
            orig_price = float(
                pricing.get("mrp", {}).get("value", 0)
                or pricing.get("mrp", 0)
                or p.get("mrp", disc_price)
                or disc_price
            )

            if disc_price <= 0:
                return None

            pid = p.get("productId") or p.get("id") or ""
            slug = p.get("slug") or p.get("productUrl") or ""

            # Build a stable, permanent product URL (session-scoped slugs without pid are dropped)
            product_url = self._build_stable_url(slug, pid, self.affiliate_tag)

            images = p.get("imageInfo", {}) or {}
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
            logger.debug(f"Flipkart product parse error: {e}")
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = FlipkartScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | Rs.{r.discounted_price} | {r.discount_percent}% off")
