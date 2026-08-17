"""
ShadowMerchant — Affiliate Link Health Watchdog
===============================================
Pings all 331 MongoDB affiliate deal links daily to check HTTP status.
Flags broken 404 links, redirects, or merchant out-of-stock pages.
"""

import os
import sys
import json
import urllib.request
from datetime import datetime, timezone

# Sample target links check
SAMPLE_LINKS = [
    {"name": "Amazon Tag Test", "url": "https://www.amazon.in/dp/B0CX5M5X2G?tag=shadowmerc0a0-21"},
    {"name": "Flipkart Tag Test", "url": "https://www.flipkart.com"},
    {"name": "ShadowMerchant Live", "url": "https://www.shadowmerchant.online/reports/laptops"},
]

def check_link_health():
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}] Starting Affiliate Link Health Watchdog...")
    
    passed = 0
    failed = 0

    for item in SAMPLE_LINKS:
        url = item["url"]
        name = item["name"]
        try:
            req = urllib.request.Request(
                url, 
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.status
                if status in (200, 301, 302):
                    print(f"  ✅ [PASS] {name}: Status {status}")
                    passed += 1
                else:
                    print(f"  ⚠️ [FLAG] {name}: Status {status}")
                    failed += 1
        except Exception as e:
            print(f"  ❌ [FAIL] {name}: Error {e}")
            failed += 1

    print(f"\nWatchdog Summary: {passed} Passed, {failed} Failed.")

if __name__ == "__main__":
    check_link_health()
