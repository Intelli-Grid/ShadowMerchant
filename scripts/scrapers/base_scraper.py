"""
ShadowMerchant — Production Base Scraper
==========================================
Provides a hardened base class with:
  - curl_cffi Chrome TLS impersonation (bypasses fingerprinting)
  - Exponential backoff with jitter
  - Rotating user agents
  - Human-like request timing
  - Health check validation before scraping
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import random
import time
import logging
import asyncio

# UA pool — rotate across requests to avoid pattern detection
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
]

# curl_cffi impersonation profiles — use the most recent Chrome
CHROME_PROFILES = ["chrome124", "chrome123", "chrome120"]


@dataclass
class RawDeal:
    title:            str
    original_price:   float
    discounted_price: float
    product_url:      str
    image_url:        str
    category:         str
    platform:         str
    rating:           float = 0.0
    rating_count:     int   = 0
    brand:            str   = ""
    deal_type:        str   = "daily"
    expires_at:       datetime = None

    @property
    def discount_percent(self) -> int:
        if self.original_price > 0 and self.discounted_price < self.original_price:
            return round((1 - self.discounted_price / self.original_price) * 100)
        return 0

    @property
    def deal_hash(self) -> str:
        key = f"{self.title.lower().strip()}{self.platform}"
        return hashlib.md5(key.encode()).hexdigest()

    def is_valid(self) -> bool:
        """Check if deal has all required fields for saving."""
        return bool(
            self.title and
            self.discounted_price > 0 and
            self.product_url and
            self.product_url.startswith("http")
        )


class BaseScraper(ABC):
    def __init__(self, platform_name: str):
        self.platform = platform_name
        self.logger   = logging.getLogger(platform_name)
        self._curl_session = None

    def get_random_ua(self) -> str:
        return random.choice(USER_AGENTS)

    def get_curl_session(self):
        """
        Returns a curl_cffi session with Chrome TLS impersonation.
        This bypasses TLS fingerprinting on Myntra, Nykaa, and others.
        """
        if self._curl_session is None:
            try:
                from curl_cffi.requests import Session
                self._curl_session = Session(
                    impersonate=random.choice(CHROME_PROFILES),
                    headers={
                        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                        "Accept-Encoding": "gzip, deflate, br",
                        "Cache-Control":   "no-cache",
                        "User-Agent":      self.get_random_ua(),
                    }
                )
            except ImportError:
                self.logger.error("curl_cffi not installed. Run: pip install curl-cffi")
                raise
        return self._curl_session

    def curl_get(self, url: str, params: dict = None, json_body: dict = None,
                 headers: dict = None, retries: int = 3, base_delay: float = 2.0) -> dict | str | None:
        """
        GET request using curl_cffi Chrome impersonation with exponential backoff.
        Returns parsed JSON if response is JSON, raw text otherwise, None on failure.
        """
        session = self.get_curl_session()
        for attempt in range(retries):
            try:
                # Human-like delay with jitter
                if attempt > 0:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                    self.logger.debug(f"Retry {attempt+1}/{retries} after {delay:.1f}s")
                    time.sleep(delay)
                else:
                    time.sleep(random.uniform(1.0, 3.0))

                resp = session.get(
                    url,
                    params=params,
                    headers=headers or {},
                    timeout=20,
                    allow_redirects=True,
                )

                if resp.status_code == 200:
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct:
                        return resp.json()
                    return resp.text
                elif resp.status_code == 429:
                    # Rate limited — back off hard
                    wait = 30 + random.uniform(0, 15)
                    self.logger.warning(f"Rate limited on {url[:50]}. Waiting {wait:.0f}s...")
                    time.sleep(wait)
                elif resp.status_code in (403, 406, 503):
                    self.logger.warning(f"Bot detection? HTTP {resp.status_code} on {url[:60]}")
                    time.sleep(5 * (attempt + 1))
                else:
                    self.logger.debug(f"HTTP {resp.status_code} on {url[:60]}")

            except Exception as e:
                self.logger.warning(f"Request error on {url[:50]}: {e}")

        self.logger.error(f"All {retries} attempts failed for {url[:60]}")
        return None

    def curl_post(self, url: str, json_body: dict = None, headers: dict = None,
                  retries: int = 3) -> dict | None:
        """POST request using curl_cffi."""
        session = self.get_curl_session()
        for attempt in range(retries):
            try:
                time.sleep(random.uniform(1.0, 2.5))
                resp = session.post(
                    url,
                    json=json_body,
                    headers=headers or {},
                    timeout=20,
                )
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 429:
                    time.sleep(20 + random.uniform(0, 10))
            except Exception as e:
                self.logger.warning(f"POST error: {e}")
                time.sleep(3 * (attempt + 1))
        return None

    def parse_price(self, text: str) -> float:
        """Extract a float price from any formatted price string."""
        if not text:
            return 0.0
        try:
            cleaned = ""
            for c in str(text):
                if c.isdigit() or c == ".":
                    cleaned += c
            return float(cleaned) if cleaned else 0.0
        except (ValueError, TypeError):
            return 0.0

    @abstractmethod
    def scrape_deals(self) -> list[RawDeal]:
        """Implement per-platform deal scraping. Must return a list of RawDeal objects."""
        pass
