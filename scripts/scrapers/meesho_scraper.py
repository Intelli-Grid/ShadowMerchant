"""
Meesho Scraper — In-Browser API approach.

Loads meesho.com in a real Playwright browser, then calls the search API
using page.evaluate() (window.fetch) so all cookies/CSRF tokens are handled
automatically by the browser. No external httpx calls needed.
"""
import sys
import os
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal
from category_map import CATEGORY_MAP

load_dotenv()
logger = logging.getLogger(__name__)

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

SEARCH_API = "https://www.meesho.com/api/v1/products/search"


class MeeshoScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="meesho")
        self.affiliate_tag = os.getenv("MEESHO_AFFILIATE_TAG", "")

    def scrape_deals(self) -> list[RawDeal]:
        try:
            return asyncio.run(self._scrape_in_browser())
        except Exception as e:
            logger.error(f"Meesho scraper error: {e}")
            return []

    async def _scrape_in_browser(self) -> list[RawDeal]:
        from playwright.async_api import async_playwright

        # Graceful stealth import
        try:
            from playwright_stealth import stealth_async
            use_stealth = True
        except (ImportError, Exception):
            use_stealth = False
            async def stealth_async(page):
                await page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    window.chrome = { runtime: {} };
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-IN', 'en']});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]});
                """)

        deals: list[RawDeal] = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            context = await browser.new_context(
                viewport={"width": 1366, "height": 768},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()
            if use_stealth:
                await stealth_async(page)

            # Load homepage to seed session cookies
            logger.info("Meesho: loading homepage for session...")
            try:
                await page.goto(
                    "https://www.meesho.com/",
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                await page.wait_for_timeout(3000)
                cookies = await context.cookies()
                logger.info(f"Meesho: session ready ({len(cookies)} cookies)")
            except Exception as e:
                logger.warning(f"Meesho: homepage load issue: {e} — proceeding anyway")

            # Call Meesho API from inside the browser for each category
            for cat_slug, query in CATEGORY_QUERIES.items():
                cat_deals = await self._fetch_category_in_browser(page, query, cat_slug)
                deals.extend(cat_deals)
                logger.info(f"Meesho [{cat_slug}]: {len(cat_deals)} deals")

            await browser.close()

        logger.info(f"Meesho: {len(deals)} total deals scraped")
        return deals

    async def _fetch_category_in_browser(self, page, query: str, cat_slug: str) -> list[RawDeal]:
        """
        Use page.evaluate() to call the Meesho API from inside the browser.
        The browser automatically sends session cookies, CSRF tokens, etc.
        """
        all_deals = []

        for page_num in range(1, 4):  # 3 pages per category = ~60 products
            payload = {
                "query": query,
                "type": "text_search",
                "page": page_num,
                "offset": (page_num - 1) * 20,
                "limit": 20,
                "isDevicePhone": False,
            }

            try:
                result = await page.evaluate(
                    """async (url, payload) => {
                        try {
                            const r = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'content-type': 'application/json',
                                    'accept': 'application/json, text/plain, */*',
                                },
                                body: JSON.stringify(payload),
                            });
                            if (!r.ok) return { error: r.status, catalogs: [] };
                            return await r.json();
                        } catch(e) {
                            return { error: String(e), catalogs: [] };
                        }
                    }""",
                    SEARCH_API,
                    payload,
                )

                if result.get("error"):
                    logger.debug(f"Meesho [{cat_slug}] p{page_num}: {result['error']}")
                    break

                catalogs = result.get("catalogs", [])
                if not catalogs:
                    break

                for catalog in catalogs:
                    deal = self._catalog_to_deal(catalog, cat_slug)
                    if deal:
                        all_deals.append(deal)

                if not result.get("cursor"):
                    break

                await page.wait_for_timeout(400)  # polite delay

            except Exception as e:
                logger.debug(f"Meesho [{cat_slug}] p{page_num} exception: {e}")
                break

        return all_deals

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

            if disc_price <= 0 or orig_price <= disc_price:
                return None

            product_id = catalog.get("product_id", "")
            slug       = catalog.get("slug") or catalog.get("original_slug") or ""
            catalog_id = catalog.get("id") or catalog.get("catalogId") or ""

            if slug and catalog_id:
                raw_url = f"https://www.meesho.com/{slug}/p/{catalog_id}"
            elif product_id:
                raw_url = f"https://www.meesho.com/s/p/{product_id}"
            else:
                return None

            product_url = f"{raw_url}?aid={self.affiliate_tag}" if self.affiliate_tag else raw_url

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
        print(f"[{r.category}] {r.title[:60]} | Rs.{r.discounted_price} (was Rs.{r.original_price})")
