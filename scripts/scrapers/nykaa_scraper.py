import sys
import os
import json
import asyncio
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

logger = logging.getLogger(__name__)

# Nykaa has a public product catalog API
NYKAA_API_URLS = [
    "https://www.nykaa.com/sp/api/search?q=sale&page=0&ptype=list&sortBy=discount&f=offer_available%3ATrue",
    "https://www.nykaa.com/api/3.0/brand-store/offers?currentPage=1&pageSize=28",
]

NYKAA_PLAYWRIGHT_URLS = [
    "https://www.nykaa.com/sale",
    "https://www.nykaa.com/offers",
]


class NykaaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="nykaa")

    def scrape_deals(self) -> list[RawDeal]:
        # Try REST API first
        deals = self._try_api()
        if deals:
            logger.info(f"Nykaa API returned {len(deals)} deals")
            return deals
        # Fallback: Playwright
        logger.info("Nykaa API returned nothing, falling back to Playwright")
        try:
            deals = asyncio.run(self._scrape_playwright())
        except Exception as e:
            logger.error(f"Nykaa Playwright fallback error: {e}")
        logger.info(f"Nykaa scraper found {len(deals)} deals total")
        return deals

    def _try_api(self) -> list[RawDeal]:
        deals = []
        headers = {
            "User-Agent": self.get_random_ua(),
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.nykaa.com/",
            "x-requested-with": "XMLHttpRequest",
        }
        for url in NYKAA_API_URLS:
            try:
                resp = self.session.get(url, headers=headers, timeout=15)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                products = (
                    data.get("response", {}).get("products", [])
                    or data.get("products", [])
                    or data.get("data", [])
                )
                logger.info(f"Nykaa API: {len(products)} products from {url}")
                for p in products[:20]:
                    try:
                        title      = p.get("name", "") or p.get("productName", "")
                        disc_price = float(p.get("discounted_price", 0) or p.get("price", 0) or 0)
                        orig_price = float(p.get("mrp", 0) or p.get("originalPrice", 0) or disc_price)
                        discount   = int(p.get("discount", 0) or (round((1 - disc_price / orig_price) * 100) if orig_price > disc_price > 0 else 0))
                        image      = p.get("imageUrl", "") or p.get("image", "")
                        slug       = p.get("slug", "") or p.get("url", "")
                        product_url = f"https://www.nykaa.com/{slug}" if slug and not slug.startswith("http") else slug
                        if not title or disc_price <= 0:
                            continue
                        deals.append(RawDeal(
                            title=title[:200],
                            platform="nykaa",
                            original_price=orig_price,
                            discounted_price=disc_price,
                            discount_percent=discount,
                            affiliate_url=product_url,
                            image_url=image,
                            category="beauty",
                        ))
                    except Exception as e:
                        logger.debug(f"Nykaa API product parse error: {e}")
            except Exception as e:
                logger.debug(f"Nykaa API request failed for {url}: {e}")
        return deals

    async def _scrape_playwright(self) -> list[RawDeal]:
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
            for url in NYKAA_PLAYWRIGHT_URLS:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(4000)
                    cards = await page.query_selector_all("div[class*='product-list-item'], div[class*='css-row']")
                    logger.info(f"Nykaa Playwright: {len(cards)} cards on {url}")
                    for card in cards[:20]:
                        try:
                            title_el = await card.query_selector("div[class*='product-name'], p[class*='css-']")
                            price_el = await card.query_selector("span[class*='discounted-price'], span[class*='css-'][class*='price']")
                            orig_el  = await card.query_selector("span[class*='mrp'], strike")
                            img_el   = await card.query_selector("img")
                            link_el  = await card.query_selector("a")

                            if not title_el or not price_el:
                                continue

                            title      = (await title_el.inner_text()).strip()
                            disc_price = self._parse_price(await price_el.inner_text())
                            orig_price = self._parse_price(await orig_el.inner_text()) if orig_el else disc_price
                            discount   = int(round((1 - disc_price / orig_price) * 100)) if orig_price > disc_price > 0 else 0
                            image      = await img_el.get_attribute("src") if img_el else ""
                            href       = await link_el.get_attribute("href") if link_el else ""
                            product_url = f"https://www.nykaa.com{href}" if href and href.startswith("/") else href

                            if not title or disc_price <= 0:
                                continue

                            deals.append(RawDeal(
                                title=title[:200],
                                platform="nykaa",
                                original_price=orig_price,
                                discounted_price=disc_price,
                                discount_percent=discount,
                                affiliate_url=product_url or "",
                                image_url=image or "",
                                category="beauty",
                            ))
                        except Exception as e:
                            logger.debug(f"Nykaa card parse error: {e}")
                except PWTimeout:
                    logger.warning(f"Nykaa timeout on {url}")
                except Exception as e:
                    logger.error(f"Nykaa error on {url}: {e}")
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
    s = NykaaScraper()
    results = s.scrape_deals()
    print(f"Found {len(results)} deals")
    for r in results[:3]:
        print(f"  {r.title[:60]} | ₹{r.discounted_price} | {r.discount_percent}% off")
