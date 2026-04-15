"""
Flipkart Scraper — Official Affiliate Product Feed API
=======================================================
Uses Flipkart's official structured JSON feed. No scraping, no blocks.
Endpoint: https://affiliate-api.flipkart.net/affiliate/api/{trackingId}.json
Returns full product catalog with prices, images, ratings, and deep links.

Setup: Generate API token at https://affiliate.flipkart.com → Tools → API
"""
import os
import sys
import json
import logging
import time
import random
import requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)

# Category IDs from the Flipkart Affiliate API directory
# Each ID maps to a product category in their feed system
FLIPKART_CATEGORY_MAP = {
    "electronics":  ["2oqYeX", "MOBDNGV3KZT7BXKZ", "2BWKAP", "CMPDNH77Y8UCHUUC"],  # Mobiles, Electronics, Laptops, Tablets
    "fashion":      ["2rjTxHe", "5VSE3L", "SHOXFTMQ9MYJ8PME"],                        # Men, Women, Kids Fashion
    "beauty":       ["BEAUU3MSMGX8AV5F", "SKIN5Q9KPE7NXHKN"],                        # Beauty, Skincare
    "home":         ["KITCHENXMHQPNVGR", "FURNDOGETKFKZXR3"],                        # Kitchen, Furniture
    "sports":       ["SPOFEZ5LU4YENB7T"],                                             # Sports & Fitness
    "books":        ["2LOJ2R"],                                                        # Books
    "toys":         ["4YZDUZ78UFFQM4XL"],                                             # Toys
    "gaming":       ["ACCEDZ57B4KGHFVK"],                                             # Gaming
}


class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="flipkart")
        self.affiliate_id    = os.getenv("FLIPKART_AFFILIATE_ID", "")
        self.affiliate_token = os.getenv("FLIPKART_AFFILIATE_TOKEN", "")
        self.base_url        = f"https://affiliate-api.flipkart.net/affiliate/api/{self.affiliate_id}.json"
        self.session         = requests.Session()

    def _api_headers(self) -> dict:
        return {
            "Fk-Affiliate-Id":    self.affiliate_id,
            "Fk-Affiliate-Token": self.affiliate_token,
            "Accept":             "application/json",
            "User-Agent":         self.get_random_ua(),
        }

    def _get_category_feed_urls(self) -> dict:
        """
        Fetch the master feed directory — returns URLs for all category feeds.
        The directory URL is: affiliate-api.flipkart.net/affiliate/api/{id}.json
        """
        if not self.affiliate_id or not self.affiliate_token:
            logger.error("Flipkart affiliate credentials not set. Check FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN in scripts/.env")
            return {}
        try:
            resp = self.session.get(
                self.base_url,
                headers=self._api_headers(),
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                feeds = {}
                api_groups = data.get("apiGroups", {})
                affiliate = api_groups.get("affiliate", {})
                listings  = affiliate.get("apiListings", {})
                for resource_name, resource_data in listings.items():
                    variants = resource_data.get("availableVariants", {})
                    v1 = variants.get("v1.1.0", {})
                    feed_url = v1.get("get", "")
                    if feed_url:
                        feeds[resource_name] = feed_url
                logger.info(f"Flipkart: Found {len(feeds)} category feeds")
                return feeds
            else:
                logger.error(f"Flipkart directory API returned {resp.status_code}")
                return {}
        except Exception as e:
            logger.error(f"Flipkart directory fetch failed: {e}")
            return {}

    def _fetch_category_feed(self, category_slug: str, feed_url: str) -> list[RawDeal]:
        """
        Fetch products from a single category feed URL.
        The feed is paginated via nextUrl in the response.
        """
        deals  = []
        url    = feed_url
        pages  = 0
        max_pages = 3  # Fetch up to 3 pages per category (each page = 500 products)

        while url and pages < max_pages:
            try:
                time.sleep(random.uniform(0.5, 1.5))  # Respect rate limits
                resp = self.session.get(url, headers=self._api_headers(), timeout=20)

                if resp.status_code != 200:
                    logger.warning(f"Flipkart feed {category_slug} page {pages+1}: HTTP {resp.status_code}")
                    break

                data     = resp.json()
                products = data.get("products", []) or data.get("productInfoList", [])

                for product in products:
                    deal = self._parse_product(product, category_slug)
                    if deal and deal.is_valid() and deal.discount_percent >= 20:
                        deals.append(deal)

                # Move to next page
                url    = data.get("nextUrl", "")
                pages += 1
                logger.debug(f"Flipkart [{category_slug}] page {pages}: {len(products)} products")

            except Exception as e:
                logger.error(f"Flipkart feed error [{category_slug}]: {e}")
                break

        return deals

    def _parse_product(self, p: dict, category_slug: str) -> RawDeal | None:
        """Parse a Flipkart API product object into a RawDeal."""
        try:
            # Product info may be nested inside productBaseInfo
            base_info = p.get("productBaseInfo", p)
            product_id = base_info.get("productId", "")

            # Title
            title = base_info.get("title", "").strip()
            if not title:
                return None

            # Pricing
            pricing    = base_info.get("productAttributes", {})
            disc_price = float(pricing.get("sellingPrice", {}).get("amount", 0) or
                               pricing.get("price", 0) or 0)
            orig_price = float(pricing.get("mrpPrice", {}).get("amount", 0) or
                               pricing.get("mrp", disc_price) or disc_price)

            if disc_price <= 0:
                return None

            # Product URL — Flipkart gives clean URLs with tracking built in
            product_url = base_info.get("productUrl", "") or \
                          f"https://www.flipkart.com/product/p/iteme?pid={product_id}&affid={self.affiliate_id}"

            # Image
            image_url = ""
            images = base_info.get("imageUrls", {})
            if images:
                image_url = (images.get("1000x1000", {}).get("url") or
                             images.get("500x500", {}).get("url") or
                             images.get("200x200", {}).get("url") or "")

            # Rating
            rating_info  = base_info.get("productRating", {})
            rating       = float(rating_info.get("average", 0) or 0)
            rating_count = int(rating_info.get("count", 0) or 0)

            # Brand
            brand = pricing.get("brand", "") or base_info.get("brand", "")

            return RawDeal(
                title           = title[:200],
                platform        = "flipkart",
                original_price  = orig_price,
                discounted_price= disc_price,
                product_url     = product_url,
                image_url       = image_url,
                category        = category_slug,
                rating          = rating,
                rating_count    = rating_count,
                brand           = brand,
            )

        except Exception as e:
            logger.debug(f"Flipkart parse error: {e}")
            return None

    def scrape_deals(self) -> list[RawDeal]:
        """
        Fetch deals from Flipkart's official Affiliate Product Feed API.
        Returns list of RawDeal objects with valid prices and affiliate URLs.
        """
        # Step 1: Get all available feed URLs from the directory
        all_feeds = self._get_category_feed_urls()
        if not all_feeds:
            logger.error("Flipkart: No feeds available. Check credentials.")
            return []

        deals = []
        # We only need a few key categories — fetching all 50+ would take too long
        target_resources = {
            "mobiles":       "electronics",
            "electronics":   "electronics",
            "laptops":       "electronics",
            "clothing":      "fashion",
            "footwear":      "fashion",
            "beauty_and_personal_care": "beauty",
            "home_furnishing":  "home",
            "sports_fitness":   "sports",
            "books":            "books",
            "toys_baby_products": "toys",
        }

        for resource_name, category_slug in target_resources.items():
            # Match against available feeds (fuzzy — resource names vary)
            matched_url = None
            for feed_name, feed_url in all_feeds.items():
                if resource_name.lower() in feed_name.lower() or feed_name.lower() in resource_name.lower():
                    matched_url = feed_url
                    break

            if matched_url:
                logger.info(f"Flipkart: Fetching {resource_name} → {category_slug}")
                category_deals = self._fetch_category_feed(category_slug, matched_url)
                deals.extend(category_deals)
                logger.info(f"Flipkart [{category_slug}]: {len(category_deals)} deals")
            else:
                logger.debug(f"Flipkart: No feed found for {resource_name}")

        logger.info(f"Flipkart total: {len(deals)} deals scraped")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = FlipkartScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.discount_percent}% off | {r.product_url[:60]}")
