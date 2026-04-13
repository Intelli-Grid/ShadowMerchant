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
            err_str = str(e)
            if "Executable doesn't exist" in err_str or "BrowserType.launch" in err_str:
                logger.warning("Amazon: Playwright binary missing — auto-installing chromium...")
                try:
                    import subprocess, sys as _sys
                    result = subprocess.run(
                        [_sys.executable, "-m", "playwright", "install", "chromium"],
                        capture_output=True, timeout=180, text=True
                    )
                    if result.returncode == 0:
                        logger.info("Amazon: Playwright install complete — retrying...")
                        return asyncio.run(self._scrape())
                    else:
                        logger.error(f"Amazon: install failed: {result.stderr[:200]}")
                except Exception as ie:
                    logger.error(f"Amazon: auto-install error: {ie}")
            logger.error(f"Amazon scraper error: {e}")
            return []  # Never raise — always return empty list

    async def _scrape(self) -> list[RawDeal]:
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout

        # Graceful stealth import — works without playwright_stealth installed
        try:
            from playwright_stealth import stealth_async
        except (ImportError, Exception):
            async def stealth_async(page):
                """Enhanced stealth: spoof multiple browser fingerprint signals."""
                await page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-IN', 'en-US', 'en']});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                    Object.defineProperty(navigator, 'platform', {get: () => 'Win32'});
                    Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 8});
                    Object.defineProperty(screen, 'colorDepth', {get: () => 24});
                """)

        # Build category URL list (prefer CATEGORY_MAP amazon URLs, fallback to search URLs)
        category_urls = []
        for cat_slug in CATEGORY_SEARCH_URLS:
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
                    "--disable-infobars",
                    "--window-size=1280,900",
                ],
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                extra_http_headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
                    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "Upgrade-Insecure-Requests": "1",
                },
            )
            semaphore = asyncio.Semaphore(3)  # 3 parallel pages max

            async def _scrape_one_category(cat_slug, url, context, stealth_async, semaphore):
                """Scrape a single Amazon category page."""
                async with semaphore:
                    cat_deals = []
                    cat_page = None
                    try:
                        cat_page = await context.new_page()
                        await stealth_async(cat_page)
                        await cat_page.goto(url, wait_until="domcontentloaded", timeout=25000)
                        await cat_page.wait_for_timeout(1500)
                        cards = await cat_page.query_selector_all(
                            "div[data-component-type='s-search-result'][data-asin]"
                        )
                        logger.info(f"Amazon [{cat_slug}]: {len(cards)} cards")

                        for card in cards[:20]:
                            try:
                                asin = await card.get_attribute("data-asin")
                                if not asin or asin.startswith("SPONSORED"):
                                    continue

                                title_el  = await card.query_selector("h2 span, h2 a span")
                                price_el  = await card.query_selector("span.a-price > span.a-offscreen")
                                orig_el   = await card.query_selector("span.a-price.a-text-price > span.a-offscreen")
                                img_el    = await card.query_selector("img.s-image")
                                rating_el = await card.query_selector("span.a-icon-alt, i.a-icon-star span")

                                if not title_el or not price_el:
                                    continue

                                title_txt = await title_el.inner_text()
                                if not title_txt.strip():
                                    continue

                                disc_price = self._parse_price(await price_el.inner_text())
                                orig_price = self._parse_price(await orig_el.inner_text()) if orig_el else disc_price

                                image = ""
                                if img_el:
                                    image = await img_el.get_attribute("src") or ""

                                rating_txt = await rating_el.inner_text() if rating_el else "0"
                                try:
                                    rating = float(rating_txt.split()[0]) if rating_txt else 0.0
                                except Exception:
                                    rating = 0.0

                                if disc_price <= 0:
                                    continue

                                product_url = f"https://www.amazon.in/dp/{asin}?tag={self.affiliate_tag}"

                                cat_deals.append(RawDeal(
                                    title=title_txt.strip()[:200],
                                    platform="amazon",
                                    original_price=orig_price,
                                    discounted_price=disc_price,
                                    product_url=product_url,
                                    image_url=image,
                                    category=cat_slug,
                                ))
                            except Exception:
                                continue
                    except Exception as e:
                        logger.warning(f"Amazon [{cat_slug}]: {e}")
                    finally:
                        if cat_page:
                            await cat_page.close()
                    return cat_deals

            tasks = [
                _scrape_one_category(cat_slug, url, context, stealth_async, semaphore)
                for cat_slug, url in category_urls
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            deals = [d for result in results if isinstance(result, list) for d in result]

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
