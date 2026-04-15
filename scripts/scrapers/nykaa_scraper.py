"""
Nykaa Scraper — HTML State Extraction (curl_cffi Chrome TLS Impersonation)
===========================================================================
Nykaa removed their public search API. We now extract from the embedded
window.__PRELOADED_STATE__ JSON in their SSR pages.

Data path: categoryListing.listingData.products

Requires: pip install curl-cffi
"""
import os
import sys
import re
import json
import time
import random
import logging
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)

AFFILIATE_TAG = os.getenv("NYKAA_AFFILIATE_TAG", "")

# Search queries per category → (search_query, our_category_slug)
NYKAA_SEARCHES = [
    ("skin care moisturizer serum",     "beauty"),
    ("face wash cleanser",              "beauty"),
    ("makeup foundation lipstick",      "beauty"),
    ("hair care shampoo conditioner",   "beauty"),
    ("sunscreen spf",                   "beauty"),
    ("perfume deodorant fragrance",     "beauty"),
    ("vitamins supplements nutrition",  "health"),
    ("protein powder whey",             "health"),
]


class NykaaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="nykaa")

    def _nykaa_headers(self) -> dict:
        return {
            "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language":  "en-IN,en;q=0.9",
            "Accept-Encoding":  "gzip, deflate, br",
            "sec-ch-ua":        '"Chromium";v="124", "Google Chrome";v="124"',
            "sec-ch-ua-mobile": "?0",
            "sec-fetch-dest":   "document",
            "sec-fetch-mode":   "navigate",
            "sec-fetch-site":   "none",
            "User-Agent":       self.get_random_ua(),
        }

    def _extract_products_from_html(self, html: str) -> list[dict]:
        """
        Extract products from Nykaa's SSR state.
        Path: categoryListing.listingData.products
        """
        match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*(.*?)</script>', html, re.DOTALL)
        if not match:
            logger.debug("Nykaa: No __PRELOADED_STATE__ in page")
            return []

        s = match.group(1).strip()
        if s.endswith(';'):
            s = s[:-1]

        try:
            data = json.loads(s)
        except Exception as e:
            logger.error(f"Nykaa JSON parse error: {e}")
            return []

        products = (
            data.get("categoryListing", {}).get("listingData", {}).get("products", []) or
            []
        )
        return products

    def _search_nykaa(self, query: str) -> list[dict]:
        """Fetch search results for a query, sorted by discount."""
        from urllib.parse import quote
        url = f"https://www.nykaa.com/search/result/?q={quote(query)}&sortBy=discount_desc"
        html = self.curl_get(url, headers=self._nykaa_headers())
        if not html or not isinstance(html, str):
            return []
        return self._extract_products_from_html(html)

    def _parse_product(self, p: dict, our_category: str) -> RawDeal | None:
        """Convert Nykaa product dict to RawDeal."""
        try:
            title = (p.get("name") or p.get("productTitle") or p.get("title") or "").strip()
            if not title:
                return None

            orig_price = float(p.get("mrp") or 0)
            disc_price = float(p.get("price") or p.get("sellingPrice") or orig_price)

            # Use discount field if prices are the same but discount exists
            if disc_price == orig_price and p.get("discount"):
                disc_pct = float(p.get("discount", 0))
                if disc_pct > 0:
                    disc_price = round(orig_price * (1 - disc_pct / 100), 2)

            if disc_price <= 0:
                return None
            if orig_price <= 0:
                orig_price = disc_price

            # URL
            slug = p.get("slug") or ""
            if slug.startswith("http"):
                product_url = slug
            elif slug:
                product_url = f"https://www.nykaa.com/{slug}"
            else:
                pid = p.get("id") or p.get("productId") or ""
                product_url = f"https://www.nykaa.com/p/{pid}" if pid else ""

            if not product_url:
                return None

            if AFFILIATE_TAG:
                sep = "&" if "?" in product_url else "?"
                product_url += f"{sep}utm_source={AFFILIATE_TAG}"

            # Image
            image_url = p.get("imageUrl") or p.get("image_url") or ""

            # Rating
            rating       = float(p.get("rating", 0) or 0)
            rating_count = int(p.get("ratingCount", 0) or p.get("rating_count", 0) or 0)
            brand        = p.get("brandName") or p.get("brand_name") or p.get("brand") or ""

            return RawDeal(
                title            = title[:200],
                platform         = "nykaa",
                original_price   = orig_price,
                discounted_price = disc_price,
                product_url      = product_url,
                image_url        = image_url,
                category         = our_category,
                rating           = rating,
                rating_count     = rating_count,
                brand            = brand,
            )

        except Exception as e:
            logger.debug(f"Nykaa parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        deals = []
        seen_ids = set()

        for (query, our_category) in NYKAA_SEARCHES:
            try:
                products = self._search_nykaa(query)
                logger.info(f"Nykaa [{our_category}] '{query}': {len(products)} products")

                for p in products:
                    # Deduplicate by product ID
                    pid = str(p.get("id") or p.get("productId") or p.get("slug", ""))
                    if pid and pid in seen_ids:
                        continue
                    if pid:
                        seen_ids.add(pid)

                    deal = self._parse_product(p, our_category)
                    if deal and deal.is_valid() and deal.discount_percent >= 10:
                        deals.append(deal)

                time.sleep(random.uniform(2, 4))

            except Exception as e:
                logger.error(f"Nykaa ['{query}'] failed: {e}")

        logger.info(f"Nykaa total: {len(deals)} deals")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = NykaaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | \u20b9{r.discounted_price} | {r.discount_percent}% off")
