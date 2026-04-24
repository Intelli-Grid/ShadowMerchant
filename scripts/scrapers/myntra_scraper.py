"""
Myntra Scraper — ScraperAPI Residential Proxy + HTML State Extraction
======================================================================
ROOT CAUSE of 0 deals: Myntra detects Render's datacenter IP range and
returns an empty page (no window.__myx state) or a bot-challenge wall.
curl_cffi Chrome TLS impersonation bypasses fingerprinting but cannot
change the IP — Myntra's IP blocklist still wins.

FIX: Route every request through ScraperAPI's residential Indian IP pool.
From Myntra's perspective, the request looks like a real Indian browser user.
The SSR HTML is returned fully-rendered with window.__myx embedded.

Credit cost: 15 sub-queries × 1 page = 15 credits/run
(shared ScraperAPI key with Meesho — total ~47 req/run → ~2,820/month)

Requires: SCRAPERAPI_KEY in env
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

AFFILIATE_TAG    = os.getenv("MYNTRA_AFFILIATE_TAG", "")
SCRAPERAPI_KEY   = os.getenv("SCRAPERAPI_KEY", "")
SCRAPERAPI_BASE  = "https://api.scraperapi.com/"

# Confirmed-working Myntra URL paths (tested 2026-04-21)
# Format: (path_segment, our_category_slug)
# NOTE: "beauty/skin-care", "sports/gym-fitness" etc return 404/redirect — use flat paths below.
MYNTRA_QUERIES = [
    ("men-tshirts",          "fashion"),
    ("men-jeans",            "fashion"),
    ("women-dresses",        "fashion"),
    ("women-tops",           "fashion"),
    ("women-sarees",         "fashion"),
    ("men-shoes",            "fashion"),
    ("women-shoes",          "fashion"),
    ("women-bags",           "fashion"),
    ("men-watches",          "fashion"),
    ("women-watches",        "fashion"),
    ("myntra-beauty",        "beauty"),    # Myntra Beauty flat path ✅
    ("skin-care",            "beauty"),
    ("men-sports-shoes",     "sports"),
    ("sports",               "sports"),    # Main sports landing ✅
    ("men-jackets",          "fashion"),
]


class MyntraScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="myntra")
        self.scraperapi_key = SCRAPERAPI_KEY

    # ─────────────────────────────────────────────────────────────
    def _fetch_via_scraperapi(self, path: str) -> str | None:
        """
        Fetch a Myntra page using ScraperAPI residential proxy.
        NOTE: The discount filter (Discount_Range) returns 0 products as of Apr 2026
        — Myntra changed the filter parameter format. We use popularity_desc and
        filter by discount_percent >= 20 ourselves in _parse_product.
        """
        import requests as _req
        target_url = f"https://www.myntra.com/{path}?sort=popularity_desc"
        params = {
            "api_key":      self.scraperapi_key,
            "url":          target_url,
            "country_code": "in",
            "render":       "false",
            "keep_headers": "true",
        }
        try:
            resp = _req.get(SCRAPERAPI_BASE, params=params, timeout=30)
            logger.info(
                f"Myntra [{path}] via ScraperAPI: HTTP {resp.status_code} "
                f"({len(resp.text)} chars, has __myx: {'__myx' in resp.text})"
            )
            if resp.status_code == 200 and "__myx" in resp.text:
                return resp.text
            elif resp.status_code == 200:
                logger.warning(f"Myntra [{path}]: page returned but no __myx")
            return None
        except Exception as e:
            logger.warning(f"Myntra [{path}] ScraperAPI fetch failed: {e}")
            return None

    # ─────────────────────────────────────────────────────────────
    def _fetch_direct(self, path: str) -> str | None:
        """Fallback direct curl_cffi fetch. Uses popularity sort (discount filter returns 0)."""
        url = f"https://www.myntra.com/{path}?sort=popularity_desc"
        headers = {
            "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language":  "en-IN,en;q=0.9,hi;q=0.8",
            "Accept-Encoding":  "gzip, deflate, br",
            "Origin":           "https://www.myntra.com",
            "Referer":          "https://www.myntra.com/sale",
            "sec-ch-ua":        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-fetch-dest":   "document",
            "sec-fetch-mode":   "navigate",
            "User-Agent":       self.get_random_ua(),
        }
        data = self.curl_get(url, headers=headers)
        if isinstance(data, str) and "__myx" in data:
            return data
        return None

    # ─────────────────────────────────────────────────────────────
    def _extract_products(self, html: str) -> list[dict]:
        """Extract products from Myntra's embedded window.__myx JSON state."""
        import json, re
        match = re.search(r'window\.__myx\s*=\s*(.*?)</script>', html, re.DOTALL)
        if not match:
            return []
        s = match.group(1).strip().rstrip(";")
        try:
            data = json.loads(s)
            return data.get("searchData", {}).get("results", {}).get("products", []) or []
        except Exception as e:
            logger.debug(f"Myntra JSON parse error: {e}")
            return []

    # ─────────────────────────────────────────────────────────────
    def _parse_product(self, p: dict, category_slug: str) -> RawDeal | None:
        try:
            brand_name   = (p.get("brand")   or "").strip()
            product_name = (p.get("product") or "").strip()
            title = f"{brand_name} {product_name}".strip() if brand_name else product_name
            # Guard: if product_name already starts with brand_name, don't duplicate it.
            # e.g. brand="H&M", product="H&M Slim Fit Shirt" → title="H&M Slim Fit Shirt"
            if brand_name and product_name.lower().startswith(brand_name.lower()):
                title = product_name.strip()
            if not title:
                return None

            # Myntra price field: may be a dict {mrp, discounted} OR a plain int
            price_obj = p.get("price", {})
            if isinstance(price_obj, dict):
                disc_price = float(price_obj.get("discounted", 0) or 0)
                orig_price = float(price_obj.get("mrp", disc_price) or disc_price)
            else:
                # price is the selling price as int
                disc_price = float(price_obj or 0)
                orig_price = float(p.get("mrp", disc_price) or disc_price)

            # Also check top-level fields
            if disc_price <= 0:
                disc_price = float(p.get("discountedPrice", 0) or p.get("sellingPrice", 0) or 0)
            if orig_price <= 0 or orig_price == disc_price:
                orig_price = float(p.get("mrp", disc_price) or disc_price)

            if disc_price <= 0:
                return None

            pid = str(p.get("productId") or p.get("id") or "")
            if not pid:
                return None
            product_url = f"https://www.myntra.com/product/{pid}"
            if AFFILIATE_TAG:
                product_url += f"?utm_source={AFFILIATE_TAG}"

            images = p.get("images", [{}])
            image_url = ""
            if images:
                src = images[0].get("src", "") if isinstance(images[0], dict) else str(images[0])
                if src:
                    image_url = src if src.startswith("http") else f"https://assets.myntassets.com/{src}"

            return RawDeal(
                title            = title[:200],
                platform         = "myntra",
                original_price   = orig_price,
                discounted_price = disc_price,
                product_url      = product_url,
                image_url        = image_url,
                category         = category_slug,
                rating           = float(p.get("rating", 0) or 0),
                rating_count     = int(p.get("ratingCount", 0) or 0),
                brand            = brand_name,
            )
        except Exception as e:
            logger.debug(f"Myntra parse error: {e}")
            return None

    # ─────────────────────────────────────────────────────────────
    def scrape_deals(self) -> list[RawDeal]:
        use_proxy = bool(self.scraperapi_key)
        if not use_proxy:
            logger.warning("SCRAPERAPI_KEY not set — Myntra will likely return 0 deals on Render (IP blocked)")

        logger.info(f"Myntra scraper starting (mode: {'ScraperAPI proxy' if use_proxy else 'direct curl_cffi'})")

        deals: list[RawDeal] = []
        seen_pids: set[str] = set()

        for (path, cat_slug) in MYNTRA_QUERIES:
            try:
                # Primary: ScraperAPI residential proxy
                html = self._fetch_via_scraperapi(path) if use_proxy else None
                # Fallback: direct (works locally, not on Render)
                if html is None:
                    logger.info(f"Myntra [{path}]: falling back to direct fetch")
                    html = self._fetch_direct(path)

                if not html:
                    logger.info(f"Myntra [{path}]: no HTML — skipping")
                    time.sleep(1)
                    continue

                products = self._extract_products(html)
                logger.info(f"Myntra [{path}] ({cat_slug}): {len(products)} products found")

                new_this_query = 0
                for p in products[:25]:
                    pid = str(p.get("productId") or p.get("id") or "")
                    if pid and pid in seen_pids:
                        continue
                    if pid:
                        seen_pids.add(pid)
                    deal = self._parse_product(p, cat_slug)
                    if deal and deal.is_valid() and deal.discount_percent >= 20:
                        deals.append(deal)
                        new_this_query += 1

                logger.info(f"Myntra [{path}]: {new_this_query} valid deals added")
                time.sleep(random.uniform(1.5, 3))

            except Exception as e:
                logger.error(f"Myntra [{path}] failed: {e}")

        logger.info(f"Myntra total: {len(deals)} deals")
        return deals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MyntraScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:5]:
        print(f"[{r.category}] {r.title[:55]} | ₹{r.discounted_price} | {r.discount_percent}% off")
