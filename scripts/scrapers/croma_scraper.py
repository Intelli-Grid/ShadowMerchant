"""
Croma Scraper — httpx + stealth session bootstrap.
Croma's search API requires cookies from a browser session. We bootstrap
via stealth Playwright then hit their JSON API with valid session cookies.
"""
import sys
import os
import logging
import httpx
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal
from scrapers.session_bootstrap import get_session

load_dotenv()
logger = logging.getLogger(__name__)

CROMA_CATEGORIES = {
    "electronics": ["Mobiles", "Laptops", "Televisions", "Headphones-and-Earphones"],
    "home": ["Air-Conditioners", "Refrigerators"],
    "gaming": ["Gaming"],
}


class CromaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="croma")
        self._cookies: dict = {}
        self._headers: dict = {}

    def _bootstrap(self):
        logger.info("Croma: bootstrapping session...")
        self._cookies, self._headers = get_session("https://www.croma.com/best-deals", wait_ms=4000)
        self._headers.update({
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        })
        logger.info(f"Croma: session ready — {len(self._cookies)} cookies")

    def _fetch_api(self, category: str, page: int = 0) -> list[dict]:
        logger.warning(f"Croma API is currently blocked by Akamai WAF __abck challenge. Skipping {category}")
        return []

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = p.get("name") or p.get("title") or ""
            if not title:
                return None

            price_obj = p.get("price", {})
            mrp_obj   = p.get("mrp", {})
            disc_price = float(
                price_obj.get("value", 0) if isinstance(price_obj, dict) else price_obj or 0
            )
            orig_price = float(
                mrp_obj.get("value", 0) if isinstance(mrp_obj, dict) else mrp_obj or disc_price
            )

            if disc_price <= 0:
                return None

            slug = p.get("url") or p.get("slug") or ""
            product_url = f"https://www.croma.com{slug}" if slug.startswith("/") else slug

            images = p.get("images", [])
            image_url = ""
            if images:
                first = images[0]
                image_url = first.get("url", "") if isinstance(first, dict) else str(first)

            return RawDeal(
                title=title.strip()[:200],
                platform="croma",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
            )
        except Exception as e:
            logger.debug(f"Croma product parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        self._bootstrap()
        deals = []

        for cat_slug, cat_names in CROMA_CATEGORIES.items():
            for cat_name in cat_names:
                try:
                    products = self._fetch_api(cat_name)
                    logger.info(f"Croma [{cat_slug}]: {len(products)} products from {cat_name}")
                    for p in products[:24]:
                        deal = self._product_to_deal(p, cat_slug)
                        if deal:
                            deals.append(deal)
                except Exception as e:
                    logger.error(f"Croma [{cat_slug}] error: {e}")

        logger.info(f"Croma: {len(deals)} deals scraped")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    s = CromaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | Rs.{r.discounted_price} | {r.discount_percent}% off")
