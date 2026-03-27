"""
Myntra Scraper — httpx + stealth session bootstrap.
Uses Myntra's internal gateway search API with a valid session.
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

AFFILIATE_TAG = os.getenv("MYNTRA_AFFILIATE_TAG", "")

CATEGORY_QUERIES = {
    "fashion":   ["sale", "men-tshirts", "women-dresses", "shoes"],
    "beauty":    ["beauty"],
    "sports":    ["sportswear", "sports-shoes"],
    "travel":    ["luggage-bags", "backpacks"],
}


class MyntraScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="myntra")
        self._cookies: dict = {}
        self._headers: dict = {}

    def _bootstrap(self):
        logger.info("Myntra: bootstrapping session...")
        self._cookies, self._headers = get_session("https://www.myntra.com/sale", wait_ms=3000)
        self._headers.update({
            "Accept": "application/json, text/plain, */*",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "X-Myntra-Abtest": "pdp_glance:true",
        })
        logger.info(f"Myntra: session ready — {len(self._cookies)} cookies")

    def _search(self, query: str) -> list[dict]:
        """Call Myntra's gateway search API."""
        url = f"https://www.myntra.com/gateway/v2/search/{query}"
        params = {"p": 1, "rows": 40, "o": 0, "plaEnabled": "false", "sort": "popularity_desc"}
        try:
            resp = httpx.get(
                url,
                params=params,
                headers=self._headers,
                cookies=self._cookies,
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("searchData", {}).get("results", []) or data.get("products", []) or []
            logger.debug(f"Myntra search {query}: status {resp.status_code}")
        except Exception as e:
            logger.debug(f"Myntra search error for {query}: {e}")
        return []

    def scrape_deals(self) -> list[RawDeal]:
        self._bootstrap()
        deals = []

        for cat_slug, queries in CATEGORY_QUERIES.items():
            for query in queries:
                try:
                    products = self._search(query)
                    logger.info(f"Myntra [{cat_slug}/{query}]: {len(products)} products")
                    for p in products[:15]:
                        deal = self._product_to_deal(p, cat_slug)
                        if deal:
                            deals.append(deal)
                except Exception as e:
                    logger.error(f"Myntra [{cat_slug}] error: {e}")

        logger.info(f"Myntra: {len(deals)} deals scraped")
        return deals

    def _product_to_deal(self, p: dict, cat_slug: str) -> RawDeal | None:
        try:
            title = (
                (p.get("product") or "")
                + " " +
                (p.get("brand") or "")
            ).strip() or p.get("productName", "")
            if not title:
                return None

            disc_price = float(p.get("price", {}).get("discounted", 0) or p.get("discountedPrice", 0) or 0)
            orig_price = float(p.get("price", {}).get("mrp", 0) or p.get("mrp", disc_price) or disc_price)

            if disc_price <= 0:
                return None

            pid = p.get("productId") or p.get("id") or ""
            product_url = f"https://www.myntra.com/{pid}" if pid else ""

            images = p.get("images", [{}])
            image_url = (
                images[0].get("src", "") if isinstance(images[0], dict) else images[0]
            ) if images else p.get("image", "")

            return RawDeal(
                title=title[:200],
                platform="myntra",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url or "",
                category=cat_slug,
            )
        except Exception as e:
            logger.debug(f"Myntra product parse error: {e}")
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MyntraScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | Rs.{r.discounted_price} | {r.discount_percent}% off")
