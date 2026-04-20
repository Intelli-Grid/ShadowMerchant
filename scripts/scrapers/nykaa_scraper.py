"""
Nykaa Scraper — curl_cffi Direct Fetch + __PRELOADED_STATE__ Extraction
========================================================================
ROOT CAUSE of 0 deals (FIXED):
  1. Multi-word search queries (e.g. "skin care moisturizer serum") return
     0 products in __PRELOADED_STATE__. Single-word/slug queries work correctly.
  2. Product price fields: `price` = selling price, `mrp` = original, `discount` = %.
  3. ScraperAPI HTTP proxy support is not available on the free plan (returns 401).
     Direct curl_cffi with Chrome TLS impersonation works locally; on Render
     the residential proxy strategy will be used once the ScraperAPI key is valid.

Credit cost (when ScraperAPI key is valid):
  10 queries × 1 page = 10 credits/run

Requires: SCRAPERAPI_KEY in env (for Render deployment)
"""
import os
import sys
import re
import json
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

AFFILIATE_TAG   = os.getenv("NYKAA_AFFILIATE_TAG", "")
SCRAPERAPI_KEY  = os.getenv("SCRAPERAPI_KEY", "")
SCRAPERAPI_BASE = "https://api.scraperapi.com/"

# Single-word/slug queries only — multi-word returns 0 in __PRELOADED_STATE__
# (query_string, our_category_slug)
NYKAA_QUERIES = [
    ("moisturizer",   "beauty"),
    ("serum",         "beauty"),
    ("facewash",      "beauty"),
    ("sunscreen",     "beauty"),
    ("shampoo",       "beauty"),
    ("lipstick",      "beauty"),
    ("foundation",    "beauty"),
    ("perfume",       "beauty"),
    ("vitamins",      "health"),
    ("protein",       "health"),
]


class NykaaScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform_name="nykaa")
        self.scraperapi_key = SCRAPERAPI_KEY

    # ─────────────────────────────────────────────────────────────
    def _fetch_page(self, query: str) -> str | None:
        """
        Fetch Nykaa search page. Tries ScraperAPI residential proxy first
        (required on Render to bypass IP blocks), falls back to direct
        curl_cffi (works locally / on clean IPs).
        """
        url = f"https://www.nykaa.com/search/result/?q={quote(query)}&sortBy=discount_desc"

        # Primary: ScraperAPI — routes through Indian residential IP
        if self.scraperapi_key:
            try:
                import requests as _req
                params = {
                    "api_key":      self.scraperapi_key,
                    "url":          url,
                    "country_code": "in",
                    "render":       "false",
                    "keep_headers": "true",
                }
                resp = _req.get(SCRAPERAPI_BASE, params=params, timeout=30)
                has_state = "__PRELOADED_STATE__" in resp.text
                logger.info(
                    f"Nykaa ['{query}'] via ScraperAPI: HTTP {resp.status_code} "
                    f"({len(resp.text)} chars, has state: {has_state})"
                )
                if resp.status_code == 200 and has_state:
                    return resp.text
                # 401 = key invalid/expired; fall through to direct
            except Exception as e:
                logger.warning(f"Nykaa ScraperAPI failed for '{query}': {e}")

        # Fallback: direct curl_cffi Chrome TLS impersonation
        headers = {
            "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language":  "en-IN,en;q=0.9",
            "Accept-Encoding":  "gzip, deflate, br",
            "sec-ch-ua":        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-fetch-dest":   "document",
            "sec-fetch-mode":   "navigate",
            "User-Agent":       self.get_random_ua(),
        }
        data = self.curl_get(url, headers=headers)
        if isinstance(data, str) and "__PRELOADED_STATE__" in data:
            logger.info(f"Nykaa ['{query}'] direct: OK ({len(data)} chars)")
            return data

        logger.info(f"Nykaa ['{query}']: no usable HTML from direct fetch either")
        return None

    # ─────────────────────────────────────────────────────────────
    def _extract_products(self, html: str) -> list[dict]:
        """
        Extract products from Nykaa's __PRELOADED_STATE__ JSON.
        Products live at: state.categoryListing.listingData.products
        """
        match = re.search(
            r'window\.__PRELOADED_STATE__\s*=\s*(.*?)</script>',
            html, re.DOTALL
        )
        if not match:
            logger.debug("Nykaa: __PRELOADED_STATE__ not found in page")
            return []
        s = match.group(1).strip().rstrip(";")
        try:
            data = json.loads(s)
        except Exception as e:
            logger.error(f"Nykaa JSON parse error: {e}")
            return []
        return data.get("categoryListing", {}).get("listingData", {}).get("products", []) or []

    # ─────────────────────────────────────────────────────────────
    def _parse_product(self, p: dict, our_category: str) -> RawDeal | None:
        """
        Parse a Nykaa product dict into a RawDeal.
        Field mapping (confirmed from live HTML probe 2026-04-21):
          price    → selling/discounted price (int)
          mrp      → original price (int)
          discount → discount percentage (int)
          slug     → URL slug e.g. "olay-super-collagen.../p/19519950"
          imageUrl → full CDN URL
        """
        try:
            title = (p.get("name") or p.get("title") or p.get("productTitle") or "").strip()
            if not title:
                return None

            orig_price = float(p.get("mrp") or 0)
            disc_price = float(p.get("price") or 0)

            # Derive selling price from discount% if price field missing
            if disc_price <= 0 and orig_price > 0:
                disc_pct = float(p.get("discount", 0) or 0)
                if disc_pct > 0:
                    disc_price = round(orig_price * (1 - disc_pct / 100), 2)

            if disc_price <= 0:
                return None
            if orig_price <= 0:
                orig_price = disc_price

            # Build product URL from slug
            slug = (p.get("slug") or "").strip()
            if slug.startswith("http"):
                product_url = slug
            elif slug:
                product_url = f"https://www.nykaa.com/{slug}"
            else:
                pid = p.get("productId") or p.get("id") or p.get("childId") or ""
                product_url = f"https://www.nykaa.com/p/{pid}" if pid else ""

            if not product_url:
                return None

            if AFFILIATE_TAG:
                sep = "&" if "?" in product_url else "?"
                product_url += f"{sep}utm_source={AFFILIATE_TAG}"

            image_url = p.get("imageUrl") or ""
            rating     = float(p.get("rating", 0) or 0)
            r_count    = int(p.get("ratingCount", 0) or 0)
            brand      = p.get("brandName") or p.get("brand_name") or ""

            return RawDeal(
                title            = title[:200],
                platform         = "nykaa",
                original_price   = orig_price,
                discounted_price = disc_price,
                product_url      = product_url,
                image_url        = image_url,
                category         = our_category,
                rating           = rating,
                rating_count     = r_count,
                brand            = brand,
            )
        except Exception as e:
            logger.debug(f"Nykaa parse error: {e}")
            return None

    # ─────────────────────────────────────────────────────────────
    def scrape_deals(self) -> list[RawDeal]:
        logger.info(
            f"Nykaa scraper starting "
            f"({'ScraperAPI proxy preferred' if self.scraperapi_key else 'direct only — SCRAPERAPI_KEY not set'})"
        )

        deals: list[RawDeal] = []
        seen_ids: set[str] = set()

        for (query, our_category) in NYKAA_QUERIES:
            try:
                html = self._fetch_page(query)

                if not html:
                    logger.info(f"Nykaa ['{query}']: no HTML — skipping")
                    time.sleep(1)
                    continue

                products = self._extract_products(html)
                logger.info(f"Nykaa ['{query}'] ({our_category}): {len(products)} products in state")

                new_this_query = 0
                for p in products:
                    pid = str(
                        p.get("productId") or p.get("id") or
                        p.get("childId") or p.get("slug", "")
                    )
                    if pid and pid in seen_ids:
                        continue
                    if pid:
                        seen_ids.add(pid)

                    deal = self._parse_product(p, our_category)
                    if deal and deal.is_valid() and deal.discount_percent >= 10:
                        deals.append(deal)
                        new_this_query += 1

                logger.info(f"Nykaa ['{query}']: {new_this_query} valid deals added")
                time.sleep(random.uniform(1.5, 3))

            except Exception as e:
                logger.error(f"Nykaa ['{query}'] failed: {e}")

        logger.info(f"Nykaa total: {len(deals)} deals")
        return deals


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO)
    s = NykaaScraper()
    results = s.scrape_deals()
    print(f"\nTotal: {len(results)} deals")
    for r in results[:8]:
        print(f"[{r.category}] {r.brand} {r.title[:45]} | Rs.{r.discounted_price} (was Rs.{r.original_price}, -{r.discount_percent}%)")
