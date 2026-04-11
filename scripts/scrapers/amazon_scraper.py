"""
Amazon Scraper — Playwright + Stealth (with graceful import fallback).
Works reliably on GitHub Actions (Linux) even without playwright_stealth installed.
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

AFFILIATE_TAG = os.getenv("AMAZON_AFFILIATE_TAG", "shadowmerc0a0-21")

# Reliable Amazon IN search URLs per category
CATEGORY_SEARCH_URLS = {
    "electronics":  "https://www.amazon.in/s?k=electronics+deals&i=electronics&s=discount-rank",
    "fashion":      "https://www.amazon.in/s?k=clothing+fashion&i=apparel&s=discount-rank",
    "beauty":       "https://www.amazon.in/s?k=beauty+skincare&i=beauty&s=discount-rank",
    "home":         "https://www.amazon.in/s?k=home+kitchen&i=kitchen&s=discount-rank",
    "sports":       "https://www.amazon.in/s?k=sports+fitness&i=sports&s=discount-rank",
    "books":        "https://www.amazon.in/s?k=bestseller+books&i=stripbooks&s=discount-rank",
    "toys":         "https://www.amazon.in/s?k=toys+kids&i=toys&s=discount-rank",
    "health":       "https://www.amazon.in/s?k=health+wellness&i=hpc&s=discount-rank",
    "automotive":   "https://www.amazon.in/s?k=car+accessories&i=automotive&s=discount-rank",
    "gaming":       "https://www.amazon.in/s?k=gaming+accessories&i=videogames&s=discount-rank",
    "travel":       "https://www.amazon.in/s?k=travel+bags+luggage&s=discount-rank",
    "grocery":      "https://www.amazon.in/s?k=grocery+food&i=grocery&s=discount-rank",
}


class AmazonScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="amazon")
        self.affiliate_tag = AFFILIATE_TAG

    def scrape_deals(self) -> list[RawDeal]:
        try:
            return asyncio.run(self._scrape())
        except Exception as e:
            logger.error(f"Amazon scraper error: {e}")
            raise e

    async def _scrape(self) -> list[RawDeal]:
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout

        # Graceful stealth import — works without playwright_stealth installed
        try:
            from playwright_stealth import stealth_async
        except (ImportError, Exception):
            async def stealth_async(page):
                """Minimal stealth: remove webdriver traces."""
                await page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    window.chrome = { runtime: {} };
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-IN', 'en']});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]});
                """)

        # Build category URL list (prefer CATEGORY_MAP amazon URLs, fallback to search URLs)
        category_urls = []
        for cat_slug in CATEGORY_SEARCH_URLS:
            # Prefer curated browse-node URL from category map if available
            amz_config = CATEGORY_MAP.get(cat_slug, {}).get("amazon", {})
            url = amz_config.get("url") or CATEGORY_SEARCH_URLS[cat_slug]
            category_urls.append((cat_slug, url))

        logger.info(f"Amazon: scraping {len(category_urls)} categories")
        deals = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                ],
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()
            await stealth_async(page)

            for cat_slug, url in category_urls:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(2000)

                    cards = await page.query_selector_all(
                        "div[data-component-type='s-search-result'][data-asin]"
                    )
                    logger.info(f"Amazon [{cat_slug}]: {len(cards)} cards")

                    for card in cards[:20]:
                        try:
                            asin = await card.get_attribute("data-asin")
                            if not asin or asin.startswith("SPONSORED"):
                                continue

                            title_el  = await card.query_selector("h2 span, h2 a span")
                            price_el  = await card.query_selector(
                                "span.a-price > span.a-offscreen"
                            )
                            orig_el   = await card.query_selector(
                                "span.a-price.a-text-price > span.a-offscreen"
                            )
                            img_el    = await card.query_selector("img.s-image")
                            rating_el = await card.query_selector(
                                "span.a-icon-alt, i.a-icon-star span"
                            )

                            if not title_el or not price_el:
                                continue

                            title      = (await title_el.inner_text()).strip()
                            disc_price = self._parse_price(await price_el.inner_text())
                            orig_price = self._parse_price(await orig_el.inner_text()) if orig_el else disc_price
                            image      = await img_el.get_attribute("src") if img_el else ""
                            rating_txt = await rating_el.inner_text() if rating_el else "0"
                            rating     = float(rating_txt.split()[0]) if rating_txt else 0.0

                            if not title or disc_price <= 0:
                                continue

                            product_url = f"https://www.amazon.in/dp/{asin}?tag={self.affiliate_tag}"

                            deals.append(RawDeal(
                                title=title[:200],
                                platform="amazon",
                                original_price=orig_price,
                                discounted_price=disc_price,
                                product_url=product_url,
                                image_url=image,
                                category=cat_slug,
                            ))
                        except Exception:
                            continue

                except PWTimeout:
                    logger.warning(f"Amazon [{cat_slug}]: page timeout")
                except Exception as e:
                    logger.warning(f"Amazon [{cat_slug}]: {e}")

            await browser.close()

        logger.info(f"Amazon: {len(deals)} deals total")
        return deals

    def _parse_price(self, text: str) -> float:
        try:
            cleaned = "".join(c for c in text if c.isdigit() or c == ".")
            return float(cleaned) if cleaned else 0.0
        except Exception:
            return 0.0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = AmazonScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.product_url[:60]}")
