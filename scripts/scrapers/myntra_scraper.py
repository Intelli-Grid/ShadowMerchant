"""
Myntra Scraper — curl_cffi Chrome TLS Impersonation
=====================================================
Myntra blocks httpx/requests via TLS fingerprinting.
curl_cffi sends Chrome's exact TLS handshake — indistinguishable from real browser.

Requires: pip install curl-cffi
"""
import os
import sys
import time
import random
import logging
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)

# Myntra search queries for each category
# These hit their search API which returns JSON product data
MYNTRA_QUERIES = {
    "fashion":  [
        ("men/tshirts",          "men-tshirts"),
        ("men/jeans",            "men-jeans"),
        ("women/dresses",        "women-dresses"),
        ("women/tops",           "women-tops"),
        ("women/sarees",         "women-sarees"),
        ("men/shoes",            "men-shoes"),
        ("women/shoes",          "women-shoes"),
        ("women/bags-purses-clutches", "women-bags"),
    ],
    "beauty": [
        ("beauty/skin-care",     "skin-care"),
        ("beauty/makeup",        "makeup"),
        ("beauty/hair-care",     "hair-care"),
        ("beauty/bath-body",     "bath-body"),
    ],
    "sports": [
        ("men/sports-shoes",     "sports-shoes"),
        ("sports/gym-fitness",   "gym-fitness"),
        ("sports/yoga",          "yoga"),
    ],
}

AFFILIATE_TAG = os.getenv("MYNTRA_AFFILIATE_TAG", "")


class MyntraScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="myntra")
        # Myntra's gateway API base — returns JSON product listings
        self.search_base = "https://www.myntra.com/gateway/v2/search"
        self.browse_base = "https://www.myntra.com/gateway/v2/search"

    def _myntra_headers(self) -> dict:
        """Headers that match Myntra's expected browser profile."""
        return {
            "Accept":          "application/json, text/plain, */*",
            "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Origin":          "https://www.myntra.com",
            "Referer":         "https://www.myntra.com/sale",
            "sec-ch-ua":       '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest":  "empty",
            "sec-fetch-mode":  "cors",
            "sec-fetch-site":  "same-origin",
            "X-Meta-App":      '{"pageType":"search","subType":""}',
            "x-location-code": "IN",
            "User-Agent":      self.get_random_ua(),
        }

    def _search(self, path: str, sort: str = "popularity_desc") -> list[dict]:
        """
        Call Myntra's search API for a given category path.
        Returns list of raw product dicts.
        """
        url    = f"{self.search_base}/{path}"
        params = {
            "o":          0,
            "p":          1,
            "rows":       40,
            "sort":       sort,
            "plaEnabled": "false",
        }

        data = self.curl_get(url, params=params, headers=self._myntra_headers())
        if not data or not isinstance(data, dict):
            return []

        # Myntra nests products at different keys depending on endpoint
        products = (
            data.get("searchData", {}).get("results", []) or
            data.get("products",   []) or
            data.get("results",    []) or
            []
        )
        return products

    def _sale_items(self, category_path: str) -> list[dict]:
        """
        Fetch sale/discounted items specifically.
        Myntra has a discount filter parameter.
        """
        url    = f"{self.search_base}/{category_path}"
        params = {
            "o":          0,
            "p":          1,
            "rows":       40,
            "sort":       "discountRange_desc",
            "plaEnabled": "false",
            "f":          "Discount_Range:30.0_100.0",  # Only 30%+ discounts
        }
        data = self.curl_get(url, params=params, headers=self._myntra_headers())
        if not data or not isinstance(data, dict):
            return []
        return (
            data.get("searchData", {}).get("results", []) or
            data.get("products", []) or []
        )

    def _parse_product(self, p: dict, category_slug: str) -> RawDeal | None:
        """Convert a Myntra product JSON object to a RawDeal."""
        try:
            # Product name + brand
            product_name = (p.get("product") or "").strip()
            brand_name   = (p.get("brand")   or "").strip()
            title = f"{brand_name} {product_name}".strip() if brand_name else product_name
            if not title:
                return None

            # Pricing — Myntra uses a price dict
            price_obj  = p.get("price", {})
            disc_price = float(price_obj.get("discounted", 0) or
                               p.get("discountedPrice", 0) or
                               p.get("price", 0) or 0)
            orig_price = float(price_obj.get("mrp", 0) or
                               p.get("mrp", disc_price) or
                               disc_price)

            if disc_price <= 0:
                return None

            # Product ID and URL
            pid         = str(p.get("productId") or p.get("id") or "")
            product_url = ""
            if pid:
                product_url = f"https://www.myntra.com/product/{pid}"
                if AFFILIATE_TAG:
                    product_url += f"?utm_source={AFFILIATE_TAG}"

            if not product_url:
                return None

            # Image
            images    = p.get("images", [{}])
            image_url = ""
            if images:
                first = images[0]
                src   = first.get("src", "") if isinstance(first, dict) else str(first)
                if src:
                    image_url = src if src.startswith("http") else f"https://assets.myntassets.com/{src}"

            # Rating
            rating       = float(p.get("rating", 0) or 0)
            rating_count = int(p.get("ratingCount", 0) or 0)

            return RawDeal(
                title            = title[:200],
                platform         = "myntra",
                original_price   = orig_price,
                discounted_price = disc_price,
                product_url      = product_url,
                image_url        = image_url,
                category         = category_slug,
                rating           = rating,
                rating_count     = rating_count,
                brand            = brand_name,
            )

        except Exception as e:
            logger.debug(f"Myntra parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        deals = []

        for category_slug, query_list in MYNTRA_QUERIES.items():
            for (path, sub_label) in query_list:
                try:
                    # Fetch discounted items first
                    products = self._sale_items(path)
                    if not products:
                        # Fallback: regular popularity sort
                        products = self._search(path)

                    logger.info(f"Myntra [{category_slug}/{sub_label}]: {len(products)} products")

                    for p in products[:20]:
                        deal = self._parse_product(p, category_slug)
                        if deal and deal.is_valid() and deal.discount_percent >= 20:
                            deals.append(deal)

                    # Human-like pause between category requests
                    time.sleep(random.uniform(2, 5))

                except Exception as e:
                    logger.error(f"Myntra [{category_slug}/{sub_label}] failed: {e}")

        logger.info(f"Myntra total: {len(deals)} deals")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MyntraScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.discount_percent}% off")
