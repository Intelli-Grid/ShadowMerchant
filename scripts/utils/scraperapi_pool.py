"""
ScraperAPI Key Pool Manager
============================
Centralised multi-key pool for all ShadowMerchant scrapers.

Usage:
    from utils.scraperapi_pool import get_pool, ScraperAPIPool

    pool = get_pool()          # singleton — reads env once
    key  = pool.active_key()   # current active key
    pool.rotate()              # advance to next key after exhaustion
    pool.mark_error(key)       # record a 402/429 against this key

Env vars (read once at import time):
    SCRAPERAPI_KEYS   — comma-separated list  (preferred)
    SCRAPERAPI_KEY    — single key fallback   (legacy)

The pool automatically deduplicates and strips whitespace.
"""

from __future__ import annotations

import os
import logging
import threading
from typing import Optional

import requests as _req

logger = logging.getLogger(__name__)

_SCRAPERAPI_ACCOUNT_URL = "https://api.scraperapi.com/account"
_LOW_CREDIT_THRESHOLD   = 50   # rotate away if fewer credits than this


class ScraperAPIPool:
    """Thread-safe rotating key pool for ScraperAPI."""

    def __init__(self, keys: list[str]) -> None:
        self._keys:        list[str]      = keys
        self._index:       int            = 0
        self._exhausted:   set[str]       = set()
        self._lock:        threading.Lock = threading.Lock()

        if self._keys:
            logger.info(
                f"[ScraperAPIPool] Loaded {len(self._keys)} key(s) "
                f"({'multi-key pool' if len(self._keys) > 1 else 'single key'})"
            )
        else:
            logger.warning("[ScraperAPIPool] No ScraperAPI keys found — proxy disabled")

    # ── Public API ──────────────────────────────────────────────────────────

    def active_key(self) -> str:
        """Return the currently active key, or '' if pool is empty/exhausted."""
        with self._lock:
            if not self._keys:
                return ""
            return self._keys[self._index]

    def rotate(self, reason: str = "manual") -> bool:
        """
        Advance to the next key with credits remaining.
        Returns True if a usable key was found, False if pool fully exhausted.
        """
        with self._lock:
            start = self._index
            for offset in range(1, len(self._keys)):
                candidate_idx = (start + offset) % len(self._keys)
                candidate_key = self._keys[candidate_idx]
                if candidate_key in self._exhausted:
                    continue
                credits = self._fetch_credits(candidate_key)
                if credits is None or credits >= _LOW_CREDIT_THRESHOLD:
                    self._index = candidate_idx
                    logger.info(
                        f"[ScraperAPIPool] Rotated key [{self._index + 1}/{len(self._keys)}] "
                        f"({credits or 'unknown'} credits left) — reason: {reason}"
                    )
                    return True
                else:
                    logger.warning(
                        f"[ScraperAPIPool] Key [{candidate_idx + 1}] also low "
                        f"({credits} credits) — skipping"
                    )
                    self._exhausted.add(candidate_key)

            logger.error(
                f"[ScraperAPIPool] All {len(self._keys)} key(s) exhausted — "
                "falling back to direct (unproxied) requests"
            )
            return False

    def mark_error(self, key: str, status_code: int) -> bool:
        """
        Call this when a request with `key` returns 402 (no credits) or
        429 (rate-limit).  Automatically rotates to the next key.
        Returns True if rotation succeeded.
        """
        with self._lock:
            if status_code in (402, 429):
                logger.warning(
                    f"[ScraperAPIPool] HTTP {status_code} on key ending "
                    f"...{key[-6:]} — marking exhausted"
                )
                self._exhausted.add(key)
        return self.rotate(reason=f"HTTP {status_code}")

    def check_credits(self, key: str | None = None) -> dict:
        """
        Query the ScraperAPI account endpoint for a key.
        Returns dict with 'remaining', 'used', 'limit', or empty dict on error.
        """
        target = key or self.active_key()
        if not target:
            return {}
        data = self._fetch_raw_account(target)
        if not data:
            return {}
        remaining = int(data.get("requestCount", 0) or 0)
        limit     = int(data.get("requestLimit", 5000) or 5000)
        return {"remaining": remaining, "used": limit - remaining, "limit": limit}

    def status_report(self) -> str:
        """Human-readable status string for logging/admin reports."""
        lines = [f"ScraperAPI Pool — {len(self._keys)} key(s)"]
        for i, k in enumerate(self._keys):
            marker  = " ◀ active" if i == self._index else ""
            exhaust = " [EXHAUSTED]" if k in self._exhausted else ""
            lines.append(f"  [{i + 1}] ...{k[-6:]}{exhaust}{marker}")
        return "\n".join(lines)

    def __bool__(self) -> bool:
        return bool(self.active_key())

    def __len__(self) -> int:
        return len(self._keys)

    # ── Internal ────────────────────────────────────────────────────────────

    def _fetch_credits(self, key: str) -> Optional[int]:
        data = self._fetch_raw_account(key)
        if not data:
            return None
        return int(data.get("requestCount", 0) or 0)

    def _fetch_raw_account(self, key: str) -> Optional[dict]:
        try:
            resp = _req.get(
                _SCRAPERAPI_ACCOUNT_URL,
                params={"api_key": key},
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            logger.debug(f"[ScraperAPIPool] Credit check failed for ...{key[-6:]}: {exc}")
        return None


# ── Module-level singleton ──────────────────────────────────────────────────

def _build_pool() -> ScraperAPIPool:
    """
    Read SCRAPERAPI_KEYS (comma-separated) or SCRAPERAPI_KEY (single)
    and return a configured ScraperAPIPool.
    """
    raw_multi = os.getenv("SCRAPERAPI_KEYS", "").strip()
    if raw_multi:
        keys = [k.strip() for k in raw_multi.split(",") if k.strip()]
    else:
        single = os.getenv("SCRAPERAPI_KEY", "").strip()
        keys = [single] if single else []

    # Deduplicate preserving insertion order
    seen: set[str] = set()
    unique_keys: list[str] = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            unique_keys.append(k)

    return ScraperAPIPool(unique_keys)


_pool_instance: Optional[ScraperAPIPool] = None
_pool_lock = threading.Lock()


def get_pool() -> ScraperAPIPool:
    """Return the module-level singleton ScraperAPIPool (lazy-initialised)."""
    global _pool_instance
    if _pool_instance is None:
        with _pool_lock:
            if _pool_instance is None:  # double-checked locking
                _pool_instance = _build_pool()
    return _pool_instance
