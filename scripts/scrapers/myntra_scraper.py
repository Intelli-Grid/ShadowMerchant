import sys
import os
import asyncio
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

logger = logging.getLogger(__name__)

MYNTRA_URLS = [
    "https://www.myntra.com/sale",
    "https://www.myntra.com/men-tshirts?rawQuery=men%20tshirts&sort=discount",
]

AFFILIATE_TAG = os.getenv("MYNTRA_AFFILIATE_TAG", "")


class MyntraScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="myntra")

    def scrape_deals(self) -> list[RawDeal]:
        try:
            return asyncio.run(self._scrape_playwright())
        except Exception as e:
            logger.error(f"Myntra scraper error: {e}")
            return []

    async def _scrape_playwright(self) -> list[RawDeal]:
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout
        deals = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.get_random_ua(),
                viewport={"width": 1366, "height": 900},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
            )
            page = await context.new_page()
            for url in MYNTRA_URLS:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(4000)
                    # Myntra product cards
                    cards = await page.query_selector_all("li.product-base")
                    logger.info(f"Myntra Playwright: {len(cards)} cards on {url}")
                    for card in cards[:25]:
                        try:
                            brand_el  = await card.query_selector("h3.product-brand")
                            name_el   = await card.query_selector("h4.product-product")
                            disc_el   = await card.query_selector("span.product-discountedPrice")
                            orig_el   = await card.query_selector("span.product-strike")
                            pct_el    = await card.query_selector("span.product-discountPercentage")
                            img_el    = await card.query_selector("img")
                            link_el   = await card.query_selector("a")

                            brand = (await brand_el.inner_text()).strip() if brand_el else ""
                            name  = (await name_el.inner_text()).strip() if name_el else ""
                            title = f"{brand} {name}".strip()

                            disc_raw = await disc_el.inner_text() if disc_el else ""
                            orig_raw = await orig_el.inner_text() if orig_el else ""
                            pct_raw  = await pct_el.inner_text() if pct_el else ""

                            disc_price = self._parse_price(disc_raw)
                            orig_price = self._parse_price(orig_raw) if orig_raw else disc_price
                            discount   = int("".join(filter(str.isdigit, pct_raw)) or 0) if pct_raw else 0

                            image = await img_el.get_attribute("src") if img_el else ""
                            href  = await link_el.get_attribute("href") if link_el else ""
                            product_url = f"https://www.myntra.com/{href}" if href and not href.startswith("http") else href

                            if not title or disc_price <= 0:
                                continue

                            deals.append(RawDeal(
                                title=title[:200],
                                platform="myntra",
                                original_price=orig_price,
                                discounted_price=disc_price,
                                discount_percent=discount,
                                affiliate_url=product_url or "",
                                image_url=image or "",
                                category="fashion",
                            ))
                        except Exception as e:
                            logger.debug(f"Myntra card parse error: {e}")
                except PWTimeout:
                    logger.warning(f"Myntra timeout on {url}")
                except Exception as e:
                    logger.error(f"Myntra error on {url}: {e}")
            await browser.close()
        logger.info(f"Myntra scraper found {len(deals)} deals")
        return deals

    def _parse_price(self, text: str) -> float:
        try:
            cleaned = "".join(c for c in text if c.isdigit() or c == ".")
            return float(cleaned) if cleaned else 0.0
        except:
            return 0.0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MyntraScraper()
    results = s.scrape_deals()
    print(f"Found {len(results)} deals")
    for r in results[:3]:
        print(f"  {r.title[:60]} | ₹{r.discounted_price} | {r.discount_percent}% off")
