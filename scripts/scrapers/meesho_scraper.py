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
    "fashion":      "fashion women clothing",
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


class MeeshoScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="meesho")
        self.affiliate_tag = os.getenv("MEESHO_AFFILIATE_TAG", "")
        self.api_url = "https://www.meesho.com/api/v1/products/search"

    def scrape_deals(self) -> list[RawDeal]:
        try:
            return asyncio.run(self._scrape_via_api())
        except Exception as e:
            logger.error(f"Meesho scraper error: {e}")
            return []

    async def _scrape_via_api(self) -> list[RawDeal]:
        """
        Two-phase approach:
        1. Launch one stealth browser page to harvest a valid session & cookies.
        2. Call Meesho's internal search API directly for all categories.
        """
        from playwright.async_api import async_playwright
        from playwright_stealth import stealth_async
        import httpx

        # Determine categories that have Meesho configured
        categories = []
        for cat_slug in CATEGORY_MAP:
            if cat_slug in CATEGORY_QUERIES:
                categories.append(cat_slug)

        logger.info(f"Meesho: Preparing to scrape {len(categories)} categories via search API.")

        # --- Phase 1: Harvest cookies from a single browser session ---
        session_cookies: dict = {}
        session_headers: dict = {}

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
            )
            page = await context.new_page()
            await stealth_async(page)

            # Capture the first live API call to get working headers/cookies
            first_req_headers: dict = {}
            async def on_request(request):
                nonlocal first_req_headers
                if "api/v1/products/search" in request.url and not first_req_headers:
                    first_req_headers = dict(request.headers)

            page.on("request", on_request)

            logger.info("Meesho: Bootstrapping session via stealth browser...")
            await page.goto(
                "https://www.meesho.com/search?q=electronics",
                wait_until="networkidle",
                timeout=30000
            )
            await page.wait_for_timeout(2000)

            # Collect cookies
            cookies_list = await context.cookies()
            session_cookies = {c["name"]: c["value"] for c in cookies_list}

            ua = await page.evaluate("() => navigator.userAgent")
            session_headers = {
                "accept": "application/json, text/plain, */*",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-IN,en;q=0.9",
                "content-type": "application/json",
                "origin": "https://www.meesho.com",
                "referer": "https://www.meesho.com/search?q=electronics",
                "user-agent": ua,
            }
            # Merge any captured request headers (especially auth/csrf tokens)
            for k, v in first_req_headers.items():
                if k.lower() not in ("content-length", "host"):
                    session_headers[k] = v

            logger.info(f"Meesho: Session ready — {len(session_cookies)} cookies, {len(session_headers)} headers.")
            await browser.close()

        # --- Phase 2: Call the API for each category ---
        deals: list[RawDeal] = []

        async with httpx.AsyncClient(
            cookies=session_cookies,
            headers=session_headers,
            timeout=20,
            follow_redirects=True,
        ) as client:
            for cat_slug in categories:
                query = CATEGORY_QUERIES[cat_slug]
                try:
                    catalogs = await self._fetch_catalogs(client, query, pages=3)
                    logger.info(f"Meesho [{cat_slug}]: {len(catalogs)} catalogs fetched.")
                    for catalog in catalogs:
                        deal = self._catalog_to_deal(catalog, cat_slug)
                        if deal:
                            deals.append(deal)
                except Exception as e:
                    logger.error(f"Meesho [{cat_slug}] API error: {e}")

        if not deals:
            logger.warning("Meesho: 0 deals scraped across all categories.")
        else:
            logger.info(f"Meesho: {len(deals)} deals scraped successfully.")

        return deals

    async def _fetch_catalogs(self, client, query: str, pages: int = 2) -> list:
        """Fetches products from Meesho's search API across multiple pages."""
        all_catalogs = []
        cursor = None
        search_session_id = None

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
            if search_session_id:
                payload["search_session_id"] = search_session_id

            resp = await client.post(self.api_url, json=payload)
            if resp.status_code != 200:
                logger.warning(f"Meesho API page {page_num} error {resp.status_code}: {resp.text[:100]}")
                break

            data = resp.json()
            catalogs = data.get("catalogs", [])
            if not catalogs:
                break

            all_catalogs.extend(catalogs)
            cursor = data.get("cursor")
            search_session_id = data.get("search_session_id")

            if not cursor:
                break

        return all_catalogs

    def _catalog_to_deal(self, catalog: dict, cat_slug: str) -> RawDeal | None:
        """Map a Meesho catalog object to a RawDeal."""
        try:
            # Name: prefer hero_product_name, then name
            title = (
                catalog.get("hero_product_name")
                or catalog.get("name")
                or ""
            ).strip()
            if not title:
                return None

            # Prices are in Rupees directly
            disc_price = float(catalog.get("min_product_price") or catalog.get("min_catalog_price") or 0)
            orig_price = float(catalog.get("max_catalog_price") or disc_price)

            if disc_price <= 0:
                return None

            # Product URL — use the short product_id for clean URLs
            product_id = catalog.get("product_id", "")
            slug = catalog.get("slug") or catalog.get("original_slug") or ""
            catalog_id = catalog.get("id") or catalog.get("catalogId") or ""

            if slug and catalog_id:
                raw_url = f"https://www.meesho.com/{slug}/p/{catalog_id}"
            elif product_id:
                raw_url = f"https://www.meesho.com/s/p/{product_id}"
            else:
                raw_url = ""

            # Affiliate tag
            if self.affiliate_tag and raw_url:
                product_url = f"{raw_url}?aid={self.affiliate_tag}"
            else:
                product_url = raw_url

            # Image: `image` field is the catalog cover (direct string URL)
            # fallback: product_images[0].url
            image_url = catalog.get("image", "")
            if not image_url:
                product_images = catalog.get("product_images") or []
                if product_images:
                    first = product_images[0]
                    if isinstance(first, dict):
                        image_url = first.get("url", "")
                    elif isinstance(first, str):
                        image_url = first

            # Discount percent
            discount_pct = None
            if orig_price > 0 and disc_price < orig_price:
                discount_pct = round((1 - disc_price / orig_price) * 100)

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
            logger.debug(f"Meesho deal parse error: {e}")
            return None

    def _parse_price(self, text: str) -> float:
        try:
            cleaned = "".join(c for c in text if c.isdigit() or c == ".")
            return float(cleaned) if cleaned else 0.0
        except:
            return 0.0


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    s = MeeshoScraper()
    results = s.scrape_deals()
    print(f"\nTotal deals: {len(results)}")
    for r in results[:6]:
        print(f"[{r.category}] {r.title[:50]} | ₹{r.discounted_price} | {r.product_url[:70]}")
