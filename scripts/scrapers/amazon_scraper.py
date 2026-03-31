"""
Amazon Scraper — Category-aware, using Playwright + Stealth.
Uses the universal category map's Amazon browse node URLs.
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


class AmazonScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="amazon")
        self.affiliate_tag = os.getenv("AMAZON_AFFILIATE_TAG", "shadowmerc0a0-21")

    def scrape_deals(self) -> list[RawDeal]:
        try:
            return asyncio.run(self._scrape_playwright())
        except Exception as e:
            logger.error(f"Amazon scraper error: {e}")
            return []

    async def _scrape_playwright(self) -> list[RawDeal]:
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout
        from playwright_stealth import Stealth

        # Gather Amazon URLs from category map
        category_urls = []
        for cat_slug, platform_config in CATEGORY_MAP.items():
            amz = platform_config.get("amazon")
            if amz and amz.get("url"):
                category_urls.append((cat_slug, amz["url"]))

        logger.info(f"Amazon: scraping {len(category_urls)} categories")
        deals = []

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
            await Stealth().apply_stealth_async(page)

            for cat_slug, url in category_urls:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(2500)

                    # Amazon search result cards
                    cards = await page.query_selector_all(
                        "div[data-component-type='s-search-result'], "
                        "div.s-result-item[data-asin]"
                    )
                    logger.info(f"Amazon [{cat_slug}]: {len(cards)} cards found")

                    for card in cards[:25]:
                        try:
                            asin = await card.get_attribute("data-asin")
                            if not asin:
                                continue

                            title_el = await card.query_selector("h2 span, h2 a span")
                            price_el = await card.query_selector(
                                "span.a-price > span.a-offscreen, "
                                "span[data-a-color='price'] span.a-offscreen"
                            )
                            orig_el = await card.query_selector(
                                "span.a-price.a-text-price > span.a-offscreen"
                            )
                            img_el = await card.query_selector("img.s-image")

                            if not title_el or not price_el:
                                continue

                            title = (await title_el.inner_text()).strip()
                            disc_price = self._parse_price(await price_el.inner_text())
                            orig_price = self._parse_price(await orig_el.inner_text()) if orig_el else disc_price
                            image = await img_el.get_attribute("src") if img_el else ""

                            if not title or disc_price <= 0:
                                continue

                            product_url = (
                                f"https://www.amazon.in/dp/{asin}"
                                f"?tag={self.affiliate_tag}"
                            )

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
                    logger.warning(f"Amazon timeout on [{cat_slug}]")
                except Exception as e:
                    logger.error(f"Amazon error on [{cat_slug}]: {e}")

            await browser.close()

        logger.info(f"Amazon scraper: {len(deals)} deals total")
        return deals

    def _parse_price(self, text: str) -> float:
        try:
            cleaned = "".join(c for c in text if c.isdigit() or c == ".")
            return float(cleaned) if cleaned else 0.0
        except:
            return 0.0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = AmazonScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.discount_percent}% off")
