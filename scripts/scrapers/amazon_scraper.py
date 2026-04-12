"""
Amazon Scraper — Render-mode ScraperAPI (No Playwright required!)
This avoids all memory/OOM crashes on Render and guarantees IP bypass.
"""
import sys
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

import requests
from bs4 import BeautifulSoup

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
        self.scraperapi_key = os.getenv("SCRAPERAPI_KEY", "")

    def scrape_deals(self) -> list[RawDeal]:
        if not self.scraperapi_key:
            logger.error("SCRAPERAPI_KEY is missing! Amazon needs it to bypass bans.")
            return []

        # Build category URL list (prefer CATEGORY_MAP amazon URLs, fallback to search URLs)
        category_urls = []
        for cat_slug in CATEGORY_SEARCH_URLS:
            amz_config = CATEGORY_MAP.get(cat_slug, {}).get("amazon", {})
            url = amz_config.get("url") or CATEGORY_SEARCH_URLS[cat_slug]
            category_urls.append((cat_slug, url))

        logger.info(f"Amazon: scraping {len(category_urls)} categories via ScraperAPI")
        deals = []

        for cat_slug, url in category_urls:
            try:
                # We use ScraperAPI render mode which natively bypasses JS firewalls on Amazon
                api_url = "http://api.scraperapi.com"
                params = {
                    "api_key": self.scraperapi_key,
                    "url": url,
                    "render": "true",
                    "country_code": "in",
                    "keep_headers": "true"
                }
                
                resp = requests.get(api_url, params=params, timeout=120)
                if resp.status_code != 200:
                    logger.warning(f"Amazon [{cat_slug}]: HTTP {resp.status_code}")
                    continue

                soup = BeautifulSoup(resp.text, 'html.parser')
                cards = soup.select("div[data-component-type='s-search-result'][data-asin]")
                
                logger.info(f"Amazon [{cat_slug}]: {len(cards)} cards")

                for card in cards[:20]:
                    try:
                        asin = card.get("data-asin")
                        if not asin or asin.startswith("SPONSORED"):
                            continue

                        title_el  = card.select_one("h2 span, h2 a span")
                        price_el  = card.select_one("span.a-price > span.a-offscreen")
                        orig_el   = card.select_one("span.a-price.a-text-price > span.a-offscreen")
                        img_el    = card.select_one("img.s-image")
                        rating_el = card.select_one("span.a-icon-alt, i.a-icon-star span")

                        if not title_el or not price_el:
                            continue

                        title      = title_el.get_text(strip=True)
                        disc_price = self._parse_price(price_el.get_text(strip=True))
                        orig_price = self._parse_price(orig_el.get_text(strip=True)) if orig_el else disc_price
                        image      = img_el.get("src") if img_el else ""
                        rating_txt = rating_el.get_text(strip=True) if rating_el else "0"
                        rating     = float(rating_txt.split()[0]) if rating_txt else 0.0

                        if not title or disc_price <= 0:
                            continue

                        product_url = f"https://www.amazon.in/dp/{asin}?tag={self.affiliate_tag}"

                        deals.append(RawDeal(
                            title=title[:200],
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
                logger.warning(f"Amazon [{cat_slug}] proxy error: {e}")

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
        print(f"[{r.category}] {r.title[:55]} | Rs.{r.discounted_price} | {r.product_url[:60]}")
