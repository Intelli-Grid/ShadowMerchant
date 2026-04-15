"""
Nykaa Scraper — curl_cffi + Internal Search API
=================================================
Uses Nykaa's search API endpoint with Chrome TLS impersonation.
Targets beauty, skincare, haircare, and wellness products.

Requires: pip install curl-cffi
"""
import os
import sys
import time
import random
import logging
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)

AFFILIATE_TAG = os.getenv("NYKAA_AFFILIATE_TAG", "")

# Nykaa category slugs → ShadowMerchant category mappings
NYKAA_CATEGORIES = [
    # (nykaa_category_slug, nykaa_root_id, our_category)
    ("skin-care",            "3",   "beauty"),
    ("makeup",               "4",   "beauty"),
    ("hair-care",            "5",   "beauty"),
    ("bath-body",            "6",   "beauty"),
    ("fragrances-deodorants","7",   "beauty"),
    ("wellness",             "8",   "health"),
    ("sports-nutrition",     "51",  "health"),
    ("nykaa-fashion",        "250", "fashion"),
]


class NykaaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="nykaa")
        # Nykaa's internal search API — returns structured JSON
        self.api_base = "https://www.nykaa.com/sp/api/search"

    def _nykaa_headers(self) -> dict:
        return {
            "Accept":           "application/json, text/plain, */*",
            "Accept-Language":  "en-IN,en;q=0.9",
            "Accept-Encoding":  "gzip, deflate, br",
            "Origin":           "https://www.nykaa.com",
            "Referer":          "https://www.nykaa.com/skin-care/c/3",
            "sec-ch-ua":        '"Chromium";v="124", "Google Chrome";v="124"',
            "sec-ch-ua-mobile": "?0",
            "sec-fetch-dest":   "empty",
            "sec-fetch-mode":   "cors",
            "sec-fetch-site":   "same-origin",
            "X-Nykaa-Platform": "web",
            "User-Agent":       self.get_random_ua(),
        }

    def _search_category(self, category_slug: str, root_id: str, page: int = 0) -> list[dict]:
        """
        Call Nykaa's search API filtered by category.
        Sort by discount to get best deals first.
        """
        url    = self.api_base
        params = {
            "q":       category_slug,
            "root":    root_id,
            "page":    page,
            "ptype":   "category",
            "sort":    "discount",             # Highest discount first
            "sortBy":  "discount",
            "f":       "offer_available:True", # Only items with offers
        }

        data = self.curl_get(url, params=params, headers=self._nykaa_headers())
        if not data or not isinstance(data, dict):
            return []

        response_data = data.get("response", {})
        products      = response_data.get("products", [])
        return products or []

    def _browse_category(self, category_slug: str, root_id: str) -> list[dict]:
        """
        Alternative: Browse category page API.
        Fallback if search API returns empty.
        """
        url = f"https://www.nykaa.com/beauty/{category_slug}/c/{root_id}"
        params = {
            "ptype":  "category",
            "sort":   "discount",
        }
        # Request as XHR to get JSON response
        headers = {**self._nykaa_headers(), "Accept": "application/json"}
        data = self.curl_get(url, params=params, headers=headers)

        if isinstance(data, dict):
            return data.get("products", [])
        return []

    def _parse_product(self, p: dict, category_slug: str) -> RawDeal | None:
        """Parse Nykaa product JSON to RawDeal."""
        try:
            title = (p.get("name") or p.get("productName") or p.get("title") or "").strip()
            if not title:
                return None

            # Nykaa prices can be in different fields
            disc_price = float(
                p.get("discounted_price") or
                p.get("price")            or
                p.get("selling_price")    or
                p.get("sellingPrice")     or 0
            )
            orig_price = float(
                p.get("mrp")              or
                p.get("originalPrice")    or
                p.get("listing_price")    or
                disc_price
            )

            if disc_price <= 0:
                return None

            # Product URL
            slug = p.get("slug") or p.get("url") or p.get("productUrl") or ""
            if slug.startswith("http"):
                product_url = slug
            elif slug:
                product_url = f"https://www.nykaa.com/{slug}"
            else:
                pid = p.get("id") or p.get("productId") or ""
                product_url = f"https://www.nykaa.com/p/{pid}" if pid else ""

            if not product_url:
                return None

            if AFFILIATE_TAG and product_url:
                product_url += f"?utm_source={AFFILIATE_TAG}"

            # Image
            images    = p.get("images", []) or []
            image_url = p.get("imageUrl") or p.get("image_url") or ""
            if not image_url and images:
                image_url = images[0] if isinstance(images[0], str) else images[0].get("url", "")

            # Rating
            rating       = float(p.get("rating", 0) or p.get("avgRating", 0) or 0)
            rating_count = int(p.get("rating_count", 0) or p.get("numRatings", 0) or 0)

            # Brand
            brand = p.get("brand_name") or p.get("brand") or ""

            return RawDeal(
                title            = title[:200],
                platform         = "nykaa",
                original_price   = orig_price,
                discounted_price = disc_price,
                product_url      = product_url,
                image_url        = image_url,
                category         = category_slug,
                rating           = rating,
                rating_count     = rating_count,
                brand            = brand,
            )

        except Exception as e:
            logger.debug(f"Nykaa parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        deals = []

        for (category_slug, root_id, sm_category) in NYKAA_CATEGORIES:
            try:
                products = self._search_category(category_slug, root_id)

                if not products:
                    logger.debug(f"Nykaa search empty for {category_slug}, trying browse...")
                    products = self._browse_category(category_slug, root_id)

                logger.info(f"Nykaa [{sm_category}/{category_slug}]: {len(products)} products")

                for p in products[:25]:
                    deal = self._parse_product(p, sm_category)
                    if deal and deal.is_valid() and deal.discount_percent >= 15:
                        deals.append(deal)

                time.sleep(random.uniform(2, 4))

            except Exception as e:
                logger.error(f"Nykaa [{category_slug}] failed: {e}")

        logger.info(f"Nykaa total: {len(deals)} deals")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = NykaaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.discount_percent}% off")
