import sys
import os
import asyncio
import logging
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

logger = logging.getLogger(__name__)

FLIPKART_URLS = [
    "https://www.flipkart.com/offers-list/deals-of-the-day",
    "https://www.flipkart.com/top-offers"
]

AFFILIATE_TAG = os.getenv("FLIPKART_AFFILIATE_TAG", "")


class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="flipkart")

    async def scrape_async(self) -> list[RawDeal]:
        deals = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.get_random_ua(),
                viewport={"width": 1280, "height": 900},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
            )
            page = await context.new_page()

            for url in FLIPKART_URLS:
                try:
                    await page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)  # let JS hydrate

                    # Grab product cards
                    cards = await page.query_selector_all('div[data-id]')
                    logger.info(f"Found {len(cards)} potential cards on {url}")

                    for card in cards[:30]:
                        try:
                            title_el = await card.query_selector('a[title]')
                            price_el = await card.query_selector('div._30jeq3')
                            orig_el  = await card.query_selector('div._3I9_wc')
                            disc_el  = await card.query_selector('div._3Ay6Sb span')
                            img_el   = await card.query_selector('img._396cs4, img._2r_T1I')
                            link_el  = await card.query_selector('a._1fQZEK, a.s1Q9rs, a[href*="/p/"]')

                            if not title_el or not price_el:
                                continue

                            title = (await title_el.get_attribute('title') or '').strip()
                            href  = await link_el.get_attribute('href') if link_el else ''
                            image = await img_el.get_attribute('src') if img_el else ''

                            price_text = await price_el.inner_text()
                            orig_text  = await orig_el.inner_text() if orig_el else price_text
                            disc_text  = await disc_el.inner_text() if disc_el else '0%'

                            current_price = self._parse_price(price_text)
                            orig_price    = self._parse_price(orig_text)
                            discount      = int(''.join(filter(str.isdigit, disc_text)) or 0)

                            if current_price <= 0 or not title:
                                continue

                            product_url = f"https://www.flipkart.com{href}" if href.startswith('/') else href
                            if AFFILIATE_TAG:
                                product_url += f"&affid={AFFILIATE_TAG}"

                            deals.append(RawDeal(
                                title=title[:200],
                                platform="flipkart",
                                original_price=orig_price or current_price,
                                discounted_price=current_price,
                                discount_percent=discount,
                                affiliate_url=product_url,
                                image_url=image,
                                category="general",
                            ))
                        except Exception as e:
                            logger.debug(f"Error parsing card: {e}")
                            continue

                except PlaywrightTimeout:
                    logger.warning(f"Timeout on {url}")
                except Exception as e:
                    logger.error(f"Error scraping {url}: {e}")

            await browser.close()

        logger.info(f"Flipkart scraper found {len(deals)} deals")
        return deals

    def scrape_deals(self) -> list[RawDeal]:
        return asyncio.run(self.scrape_async())

    def _parse_price(self, text: str) -> float:
        try:
            return float(''.join(c for c in text if c.isdigit() or c == '.'))
        except:
            return 0.0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scraper = FlipkartScraper()
    results = scraper.scrape()
    print(f"Found {len(results)} deals")
    for r in results[:3]:
        print(r)
