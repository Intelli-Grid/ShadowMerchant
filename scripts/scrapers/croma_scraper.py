import sys
import os
import json
import asyncio
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

logger = logging.getLogger(__name__)

# Croma's internal search API (JSON) – much more reliable than HTML scraping
CROMA_API_URLS = [
    "https://api.croma.com/searchservices/v2/search?q=:relevance:isOnOffer:True&currentPage=0&pageSize=24&sort=discount",
    "https://api.croma.com/searchservices/v2/search?q=:discount-desc&currentPage=0&pageSize=24&sort=discount&category=Laptops",
    "https://api.croma.com/searchservices/v2/search?q=:discount-desc&currentPage=0&pageSize=24&sort=discount&category=Mobiles",
]

CROMA_PLAYWRIGHT_URLS = [
    "https://www.croma.com/searchB?q=%3Arelevance%3AisOnOffer%3ATrue&currentPage=0&sortBy=discount",
]


class CromaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="croma")

    def scrape_deals(self) -> list[RawDeal]:
        # Try API first (fast, reliable)
        deals = self._try_api()
        if deals:
            logger.info(f"Croma API returned {len(deals)} deals")
            return deals
        # Fallback to Playwright
        logger.info("Croma API returned nothing, falling back to Playwright")
        try:
            deals = asyncio.run(self._scrape_playwright())
        except Exception as e:
            logger.error(f"Croma Playwright fallback failed: {e}")
        logger.info(f"Croma scraper found {len(deals)} deals total")
        return deals

    def _try_api(self) -> list[RawDeal]:
        """Try Croma's internal JSON search API."""
        deals = []
        headers = {
            "User-Agent": self.get_random_ua(),
            "Accept": "application/json",
            "Referer": "https://www.croma.com/",
            "x-requested-with": "XMLHttpRequest",
        }
        for url in CROMA_API_URLS:
            try:
                resp = self.session.get(url, headers=headers, timeout=15)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                products = (
                    data.get("searchresult", {}).get("results", [])
                    or data.get("products", [])
                    or data.get("data", {}).get("products", [])
                )
                logger.info(f"Croma API: {len(products)} products from {url}")
                for p in products[:20]:
                    try:
                        title = p.get("name", "") or p.get("title", "")
                        disc_price = float(p.get("price", {}).get("value", 0) or p.get("discountedPrice", 0) or 0)
                        orig_price = float(p.get("mrp", {}).get("value", 0) or p.get("mrpPrice", 0) or disc_price)
                        discount = int(p.get("discountPercent", 0) or (round((1 - disc_price / orig_price) * 100) if orig_price > disc_price > 0 else 0))
                        image = p.get("images", [{}])[0].get("url", "") if p.get("images") else ""
                        slug = p.get("url", "") or p.get("slug", "")
                        product_url = f"https://www.croma.com{slug}" if slug.startswith("/") else slug
                        if not title or disc_price <= 0:
                            continue
                        deals.append(RawDeal(
                            title=title[:200],
                            platform="croma",
                            original_price=orig_price,
                            discounted_price=disc_price,
                            discount_percent=discount,
                            affiliate_url=product_url,
                            image_url=image,
                            category="electronics",
                        ))
                    except Exception as e:
                        logger.debug(f"Croma API card parse error: {e}")
            except Exception as e:
                logger.debug(f"Croma API request failed for {url}: {e}")
        return deals

    async def _scrape_playwright(self) -> list[RawDeal]:
        """Playwright fallback - renders JS and scrapes product cards."""
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout
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
            for url in CROMA_PLAYWRIGHT_URLS:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(4000)
                    cards = await page.query_selector_all("li.product-item")
                    logger.info(f"Croma Playwright: {len(cards)} cards on {url}")
                    for card in cards[:20]:
                        try:
                            title_el = await card.query_selector("h3.product-title")
                            price_el = await card.query_selector("span.pdp-price strong, span.discounted-price")
                            orig_el  = await card.query_selector("s.amount, span.price-through")
                            img_el   = await card.query_selector("img")
                            link_el  = await card.query_selector("a")

                            title = await title_el.inner_text() if title_el else ""
                            disc_raw = await price_el.inner_text() if price_el else ""
                            orig_raw = await orig_el.inner_text() if orig_el else ""
                            image = await img_el.get_attribute("src") if img_el else ""
                            href  = await link_el.get_attribute("href") if link_el else ""

                            disc_price = self._parse_price(disc_raw)
                            orig_price = self._parse_price(orig_raw) if orig_raw else disc_price
                            discount   = int(round((1 - disc_price / orig_price) * 100)) if orig_price > disc_price > 0 else 0
                            product_url = f"https://www.croma.com{href}" if href.startswith("/") else href

                            if not title.strip() or disc_price <= 0:
                                continue

                            deals.append(RawDeal(
                                title=title.strip()[:200],
                                platform="croma",
                                original_price=orig_price,
                                discounted_price=disc_price,
                                discount_percent=discount,
                                affiliate_url=product_url,
                                image_url=image or "",
                                category="electronics",
                            ))
                        except Exception as e:
                            logger.debug(f"Croma PW card error: {e}")
                except PWTimeout:
                    logger.warning(f"Croma Playwright timeout on {url}")
                except Exception as e:
                    logger.error(f"Croma Playwright error on {url}: {e}")
            await browser.close()
        return deals

    def _parse_price(self, text: str) -> float:
        try:
            cleaned = "".join(c for c in text if c.isdigit() or c == ".")
            return float(cleaned) if cleaned else 0.0
        except:
            return 0.0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = CromaScraper()
    results = s.scrape_deals()
    print(f"Found {len(results)} deals")
    for r in results[:3]:
        print(f"  {r.title[:60]} | ₹{r.discounted_price} | {r.discount_percent}% off")
