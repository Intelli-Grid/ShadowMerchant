"""
Croma Scraper — Playwright Stealth + REST API
==============================================
Croma exposes a JSON search API but requires browser cookies.
Strategy: Launch stealth browser once to harvest cookies,
          then use those cookies for all API calls (much faster).

Same pattern as the Amazon scraper — proven to work in CI.
"""
import os
import sys
import asyncio
import logging
import time
import random
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)

# Croma's searchservices API — returns structured JSON product data
# These are the confirmed working v2 endpoints (verified April 2026)
CROMA_SEARCH_URLS = {
    "electronics": [
        "https://api.croma.com/searchservices/v2/search?q=%3Arelevance%3AisOnOffer%3ATrue&currentPage=0&pageSize=24&sort=discount-desc",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Mobiles",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Laptops",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Televisions",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Headphones-and-Earphones",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Smartwatches",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Cameras-and-Photography",
    ],
    "home": [
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Air-Conditioners",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Refrigerators",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Washing-Machines",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Microwave-Ovens",
    ],
    "gaming": [
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Gaming",
        "https://api.croma.com/searchservices/v2/search?q=%3Adiscount-desc&currentPage=0&pageSize=24&category=Gaming-Accessories",
    ],
}


class CromaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="croma")
        self._cookies: dict = {}
        self._headers: dict = {}

    def _bootstrap_session(self):
        """
        Launch a stealth Playwright browser, visit Croma's deals page,
        harvest cookies and headers, then close the browser.
        All subsequent API calls use these credentials.
        """
        asyncio.run(self._async_bootstrap())

    async def _async_bootstrap(self):
        from playwright.async_api import async_playwright
        try:
            from playwright_stealth import stealth_async
            use_stealth = True
        except ImportError:
            use_stealth = False

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            context = await browser.new_context(
                viewport={"width": 1366, "height": 768},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                user_agent=self.get_random_ua(),
            )
            page = await context.new_page()

            if use_stealth:
                await stealth_async(page)

            # Intercept the API call to get auth headers
            captured_headers = {}
            async def on_request(req):
                nonlocal captured_headers
                if "api.croma.com" in req.url and not captured_headers:
                    captured_headers = dict(req.headers)

            page.on("request", on_request)

            # Visit Croma's best deals page — this triggers the API call we need
            try:
                await page.goto(
                    "https://www.croma.com/best-deals",
                    wait_until="networkidle",
                    timeout=30000,
                )
                await page.wait_for_timeout(3000)
            except Exception as e:
                logger.warning(f"Croma bootstrap page load issue (continuing): {e}")

            # Collect session cookies
            cookies_list = await context.cookies()
            self._cookies = {c["name"]: c["value"] for c in cookies_list}

            # Build headers from captured API request + defaults
            ua = await page.evaluate("() => navigator.userAgent")
            self._headers = {
                "Accept":          "application/json, text/plain, */*",
                "Accept-Language": "en-IN,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Origin":          "https://www.croma.com",
                "Referer":         "https://www.croma.com/best-deals",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent":       ua,
            }

            # Merge any captured API headers (especially auth tokens)
            if captured_headers:
                for k, v in captured_headers.items():
                    if k.lower() not in ("content-length", "host", "connection"):
                        self._headers[k] = v

            await browser.close()

        logger.info(f"Croma session bootstrapped: {len(self._cookies)} cookies, {len(self._headers)} headers")

    def _fetch_api(self, url: str) -> list[dict]:
        """Fetch Croma API using the bootstrapped session credentials."""
        data = self.curl_get(
            url,
            headers=self._headers,
        )
        if not data or not isinstance(data, dict):
            return []

        return (
            data.get("searchresult", {}).get("results", []) or
            data.get("products",     []) or
            data.get("results",      []) or
            []
        )

    def _parse_product(self, p: dict, category_slug: str) -> RawDeal | None:
        try:
            title = (p.get("name") or p.get("title") or "").strip()
            if not title:
                return None

            # Croma price structure
            price_obj  = p.get("price", {})
            mrp_obj    = p.get("mrp",   {})
            disc_price = float(price_obj.get("value", 0) if isinstance(price_obj, dict) else price_obj or 0)
            orig_price = float(mrp_obj.get("value",   0) if isinstance(mrp_obj,   dict) else mrp_obj   or disc_price)

            if disc_price <= 0:
                return None

            # Product URL
            slug        = p.get("url") or p.get("slug") or ""
            product_url = f"https://www.croma.com{slug}" if slug.startswith("/") else slug
            if not product_url.startswith("http"):
                product_id  = p.get("id") or p.get("code") or ""
                product_url = f"https://www.croma.com/product/{product_id}" if product_id else ""

            # Image
            image_url = ""
            images    = p.get("images", [])
            if images:
                first = images[0]
                image_url = first.get("url", "") if isinstance(first, dict) else str(first)
                if image_url and not image_url.startswith("http"):
                    image_url = f"https://media.croma.com{image_url}"

            # Rating
            rating       = float(p.get("averageRating", 0) or p.get("rating", 0) or 0)
            rating_count = int(p.get("numberOfReviews", 0) or p.get("ratingCount", 0) or 0)

            # Brand
            brand = p.get("brand", "") or p.get("manufacturerName", "")

            return RawDeal(
                title            = title[:200],
                platform         = "croma",
                original_price   = orig_price,
                discounted_price = disc_price,
                product_url      = product_url,
                image_url        = image_url,
                category         = category_slug,
                rating           = rating,
                rating_count     = rating_count,
                brand            = brand,
            )

        except Exception as e:
            logger.debug(f"Croma parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        # Bootstrap browser session first
        logger.info("Croma: Bootstrapping browser session...")
        self._bootstrap_session()

        if not self._cookies and not self._headers:
            logger.error("Croma: Session bootstrap failed — no cookies collected")
            return []

        deals = []
        for category_slug, urls in CROMA_SEARCH_URLS.items():
            for url in urls:
                try:
                    products = self._fetch_api(url)
                    cat_label = url.split("category=")[-1].split("&")[0] if "category=" in url else "general"
                    logger.info(f"Croma [{category_slug}/{cat_label}]: {len(products)} products")

                    for p in products[:24]:
                        deal = self._parse_product(p, category_slug)
                        if deal and deal.is_valid() and deal.discount_percent >= 10:
                            deals.append(deal)

                    time.sleep(random.uniform(1, 3))

                except Exception as e:
                    logger.error(f"Croma [{category_slug}] URL failed: {e}")

        logger.info(f"Croma total: {len(deals)} deals")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = CromaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.discount_percent}% off")
