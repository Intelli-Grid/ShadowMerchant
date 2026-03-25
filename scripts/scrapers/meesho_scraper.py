import sys
import os
import json
import asyncio
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

logger = logging.getLogger(__name__)

# Meesho uses a GraphQL API internally
MEESHO_GRAPHQL_URL = "https://meesho.com/api/v1/products/search"

# Category IDs to hit
MEESHO_CATEGORIES = [
    {"id": "tops", "name": "Tops"},
    {"id": "kurtis", "name": "Kurtis"},
    {"id": "shirts", "name": "Shirts"},
]


class MeeshoScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="meesho")

    def scrape_deals(self) -> list[RawDeal]:
        # Try Playwright (JS rendering)
        try:
            return asyncio.run(self._scrape_playwright())
        except Exception as e:
            logger.error(f"Meesho scraper error: {e}")
            return []

    async def _scrape_playwright(self) -> list[RawDeal]:
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout
        deals = []
        urls = [
            "https://meesho.com/category/womens-wear/products?sort=popularity_score",
            "https://meesho.com/category/mens-wear/products?sort=popularity_score",
        ]
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.get_random_ua(),
                viewport={"width": 1280, "height": 900},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
            )
            page = await context.new_page()

            # Intercept API responses on product listing pages
            api_products = []

            async def handle_response(response):
                try:
                    if "productslist" in response.url or "product-list" in response.url or "/api/v1/product" in response.url:
                        data = await response.json()
                        products = data.get("products", data.get("data", {}).get("products", []))
                        if products:
                            api_products.extend(products)
                            logger.info(f"Meesho intercepted {len(products)} products from {response.url}")
                except Exception:
                    pass

            page.on("response", handle_response)

            for url in urls:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(5000)

                    # If we got API data via intercept, use it
                    if api_products:
                        continue

                    # Fallback: scrape rendered cards
                    cards = await page.query_selector_all("div[class*='ProductCard'], div[class*='product-card-container']")
                    logger.info(f"Meesho Playwright: {len(cards)} cards on {url}")
                    for card in cards[:25]:
                        try:
                            title_el = await card.query_selector("p[class*='productName'], p[class*='product-name']")
                            price_el = await card.query_selector("h5, span[class*='discounted-price'], p[class*='price-new']")
                            orig_el  = await card.query_selector("p[class*='strikethrough'], span[class*='price-old']")
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
                            product_url = f"https://meesho.com{href}" if href and href.startswith("/") else href

                            if not title or disc_price <= 0:
                                continue

                            deals.append(RawDeal(
                                title=title[:200],
                                platform="meesho",
                                original_price=orig_price,
                                discounted_price=disc_price,
                                discount_percent=discount,
                                affiliate_url=product_url or "",
                                image_url=image or "",
                                category="fashion",
                            ))
                        except Exception as e:
                            logger.debug(f"Meesho card parse error: {e}")

                except PWTimeout:
                    logger.warning(f"Meesho timeout on {url}")
                except Exception as e:
                    logger.error(f"Meesho error on {url}: {e}")

            await browser.close()

        # Process intercepted API data if any
        for p_data in api_products[:30]:
            try:
                title = p_data.get("name", "") or p_data.get("productName", "")
                disc_price = float(p_data.get("finalPrice", 0) or p_data.get("discountedPrice", 0) or 0)
                orig_price = float(p_data.get("originalPrice", 0) or p_data.get("price", 0) or disc_price)
                discount   = int(p_data.get("discountPercent", 0) or (round((1 - disc_price / orig_price) * 100) if orig_price > disc_price > 0 else 0))
                image      = p_data.get("images", [{}])[0].get("url", "") if p_data.get("images") else ""
                slug       = p_data.get("slug", "")
                product_url = f"https://meesho.com/{slug}" if slug else ""
                if not title or disc_price <= 0:
                    continue
                deals.append(RawDeal(
                    title=title[:200],
                    platform="meesho",
                    original_price=orig_price,
                    discounted_price=disc_price,
                    discount_percent=discount,
                    affiliate_url=product_url,
                    image_url=image,
                    category="fashion",
                ))
            except Exception as e:
                logger.debug(f"Meesho API product error: {e}")

        logger.info(f"Meesho scraper found {len(deals)} deals")
        return deals

    def _parse_price(self, text: str) -> float:
        try:
            cleaned = "".join(c for c in text if c.isdigit() or c == ".")
            return float(cleaned) if cleaned else 0.0
        except:
            return 0.0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MeeshoScraper()
    results = s.scrape_deals()
    print(f"Found {len(results)} deals")
    for r in results[:3]:
        print(f"  {r.title[:60]} | ₹{r.discounted_price} | {r.discount_percent}% off")
