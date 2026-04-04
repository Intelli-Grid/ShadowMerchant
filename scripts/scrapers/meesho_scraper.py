"""
Meesho Scraper — ScraperAPI render mode + BeautifulSoup HTML parsing.
FULLY SYNCHRONOUS — no asyncio, no event loop conflicts.

Uses ScraperAPI's headless Chrome (residential IP) to load Meesho search
pages with JavaScript, then parses the rendered HTML for product data.

Free tier: 5,000 credits/month (~10 credits per rendered page).
Usage: 6 categories x 3 pages = up to 18 renders/run (~180 credits).
That allows ~27 full runs/month on the free tier.

Env vars needed:
  SCRAPERAPI_KEY  — from scraperapi.com (free signup, no credit card)
  MEESHO_AFFILIATE_TAG — your Meesho affiliate tag (optional)
"""
import logging
import os
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
from scrapers.base_scraper import BaseScraper, RawDeal

load_dotenv()
logger = logging.getLogger(__name__)

SCRAPERAPI_URL = "https://api.scraperapi.com"
MEESHO_BASE    = "https://www.meesho.com"

# Top 6 categories — best balance of breadth vs. free-tier credit budget
CATEGORY_QUERIES = {
    "electronics":  "electronics gadgets",
    "fashion":      "women fashion clothing",
    "beauty":       "beauty skincare makeup",
    "home":         "home decor kitchen",
    "sports":       "sports fitness gym",
    "health":       "health wellness supplements",
}

# If Meesho only shows one price (no MRP strikethrough), assume 35% discount
DEFAULT_DISCOUNT_FACTOR = 1.35


class MeeshoScraper(BaseScraper):

    def __init__(self):
        super().__init__(platform_name="meesho")
        self.affiliate_tag  = os.getenv("MEESHO_AFFILIATE_TAG", "")
        self.scraperapi_key = os.getenv("SCRAPERAPI_KEY", "")

    # ─────────────────────────────────────────────────────────────
    def scrape_deals(self) -> list[RawDeal]:
        logger.info("Meesho scraper v4 (sync requests + ScraperAPI render) starting...")
        if not self.scraperapi_key:
            logger.error(
                "Meesho: SCRAPERAPI_KEY not set. "
                "Add it to Render env vars — get it free at scraperapi.com"
            )
            return []

        all_deals: list[RawDeal] = []

        for cat_slug, query in CATEGORY_QUERIES.items():
            cat_deals = self._scrape_category(query, cat_slug)
            all_deals.extend(cat_deals)
            logger.info(f"Meesho [{cat_slug}]: {len(cat_deals)} deals")
            time.sleep(3)   # Polite delay between categories (avoids rate limits)

        logger.info(f"Meesho total: {len(all_deals)} deals")
        return all_deals

    # ─────────────────────────────────────────────────────────────
    def _scrape_category(self, query: str, cat_slug: str) -> list[RawDeal]:
        all_deals: list[RawDeal] = []

        for page in range(1, 4):   # Up to 3 pages per category (~20 products each)
            url  = f"{MEESHO_BASE}/search?q={query}&page={page}"
            html = self._fetch_with_retry(url)
            if not html:
                break   # Stop trying more pages if this one failed

            soup  = BeautifulSoup(html, "html.parser")
            cards = soup.find_all("a", href=lambda h: h and "/p/" in h)

            if not cards:
                logger.debug(f"Meesho [{cat_slug}] p{page}: no product cards in HTML")
                break

            for card in cards:
                deal = self._parse_card(card, cat_slug)
                if deal:
                    all_deals.append(deal)

            logger.debug(
                f"Meesho [{cat_slug}] p{page}: {len(cards)} cards → "
                f"{len(all_deals)} valid deals so far"
            )
            time.sleep(2)   # Polite delay between pages

        return all_deals

    # ─────────────────────────────────────────────────────────────
    def _fetch_with_retry(self, url: str, retries: int = 3) -> str | None:
        """Fetch via ScraperAPI render mode (sync requests, no asyncio)."""
        for attempt in range(1, retries + 1):
            try:
                r = requests.get(
                    SCRAPERAPI_URL,
                    params={
                        "api_key":      self.scraperapi_key,
                        "url":          url,
                        "render":       "true",
                        "country_code": "in",
                    },
                    timeout=90,
                )
                if r.status_code == 200 and len(r.text) > 5000:
                    return r.text
                logger.debug(
                    f"ScraperAPI attempt {attempt}: HTTP {r.status_code} "
                    f"({len(r.text)} chars) for {url}"
                )
            except Exception as e:
                logger.debug(f"ScraperAPI attempt {attempt} error: {e}")

            if attempt < retries:
                time.sleep(2 * attempt)   # 2s, then 4s before final retry

        logger.warning(f"Meesho: all {retries} attempts failed for {url}")
        return None

    # ─────────────────────────────────────────────────────────────
    def _parse_card(self, card, cat_slug: str) -> RawDeal | None:
        """
        Parse one product <a> card element.

        Confirmed HTML structure (Meesho 2024-2026):
          <a href="/slug/p/id">
            <p color="greyT2">Product Title</p>       ← title
            <h5 font-weight="bold">₹88</h5>           ← discounted price
            <s>₹120</s>                               ← original price (if shown)
            <img src="https://images.meesho.com/..." />
        """
        try:
            href = card.get("href", "")
            if not href or "/p/" not in href:
                return None

            # ─── Product URL ──────────────────────────────────────
            product_url = f"{MEESHO_BASE}/{href.lstrip('/')}"
            if self.affiliate_tag:
                product_url += f"?aid={self.affiliate_tag}"

            # ─── Title ───────────────────────────────────────────
            title_tag = card.find(["p", "span", "div"], attrs={"color": "greyT2"})
            if not title_tag:
                title_tag = card.find("p")
            title = title_tag.get_text(strip=True) if title_tag else ""
            if not title:
                img = card.find("img")
                title = img.get("alt", "") if img else ""
            if not title:
                return None

            # ─── Prices ──────────────────────────────────────────
            disc_tag = card.find("h5", attrs={"font-weight": "bold"})
            if not disc_tag:
                disc_tag = card.find("h5")
            disc_price = self._parse_price(disc_tag.get_text(strip=True) if disc_tag else "")

            if disc_price <= 0:
                return None

            orig_tag   = card.find("s")
            orig_price = self._parse_price(orig_tag.get_text(strip=True)) if orig_tag else 0.0

            if orig_price <= disc_price:
                orig_price = round(disc_price * DEFAULT_DISCOUNT_FACTOR)

            # ─── Image ───────────────────────────────────────────
            img_tag   = card.find("img", src=lambda s: s and "meesho.com" in s)
            image_url = img_tag.get("src", "") if img_tag else ""

            return RawDeal(
                title=title[:200],
                platform="meesho",
                original_price=orig_price,
                discounted_price=disc_price,
                product_url=product_url,
                image_url=image_url,
                category=cat_slug,
            )

        except Exception as e:
            logger.debug(f"Meesho card parse error: {e}")
            return None

    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def _parse_price(text: str) -> float:
        """Extract numeric price from strings like '₹88', 'Rs.120', '1,499'."""
        cleaned = re.sub(r"[^\d.]", "", text)
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return 0.0


# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = MeeshoScraper()
    results = s.scrape_deals()
    print(f"\nTotal deals: {len(results)}")
    for r in results[:8]:
        pct = int((1 - r.discounted_price / r.original_price) * 100)
        print(
            f"[{r.category}] {r.title[:55]:<55} "
            f"Rs.{r.discounted_price:>6.0f}  (was Rs.{r.original_price:.0f}, -{pct}%)"
        )
