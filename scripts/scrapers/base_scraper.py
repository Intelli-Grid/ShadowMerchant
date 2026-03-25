from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import requests
import random
import time
import logging

@dataclass
class RawDeal:
    title: str
    original_price: float
    discounted_price: float
    product_url: str
    image_url: str
    category: str
    platform: str
    rating: float = 0.0
    rating_count: int = 0
    brand: str = ""
    deal_type: str = "daily"
    expires_at: datetime = None

    @property
    def discount_percent(self):
        if self.original_price > 0:
            return round((1 - self.discounted_price / self.original_price) * 100)
        return 0

    @property
    def deal_hash(self):
        key = f"{self.title.lower().strip()}{self.platform}"
        return hashlib.md5(key.encode()).hexdigest()

class BaseScraper(ABC):
    def __init__(self, platform_name: str):
        self.platform = platform_name
        self.session = requests.Session()
        self.logger = logging.getLogger(platform_name)

    def get_random_ua(self):
        uas = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ]
        return random.choice(uas)

    def get_proxy(self):
        # Implementation to retrieve proxies if needed
        return None

    def get(self, url: str, retries=3) -> str | None:
        for attempt in range(retries):
            try:
                self.session.headers.update({"User-Agent": self.get_random_ua()})
                resp = self.session.get(url, timeout=15, proxies=self.get_proxy())
                resp.raise_for_status()
                time.sleep(random.uniform(2, 5))
                return resp.text
            except Exception as e:
                self.logger.warning(f"Attempt {attempt+1} failed: {e}")
                time.sleep(2 ** attempt)
        return None

    @abstractmethod
    def scrape_deals(self) -> list[RawDeal]:
        pass
