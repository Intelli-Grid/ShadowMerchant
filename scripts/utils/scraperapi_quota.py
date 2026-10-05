"""
ShadowMerchant — ScraperAPI Quota Safety Gate
=============================================
PRE-03 (code part): Check remaining ScraperAPI credits before executing any
scraper that consumes them (Myntra: ~15 req/run, Nykaa: ~8 req/run).

If credits fall below MIN_CREDITS_THRESHOLD, the scraper run is skipped
and the admin is alerted via Telegram so they can take action.

Usage:
    from utils.scraperapi_quota import check_scraperapi_quota, QUOTA_OK, QUOTA_LOW, QUOTA_EMPTY

    result = check_scraperapi_quota()
    if result == QUOTA_EMPTY:
        log.warning("ScraperAPI credits exhausted — skipping Myntra/Nykaa")
        return

Docs: https://docs.scraperapi.com/making-requests/account-management
"""
import os
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

log = logging.getLogger("scraperapi_quota")

# Thresholds
CREDITS_PER_RUN_ESTIMATE = 25   # Myntra(15) + Nykaa(8) + buffer(2)
MIN_CREDITS_THRESHOLD    = 30   # Alert when below this — less than 1 full run

QUOTA_OK    = "ok"
QUOTA_LOW   = "low"
QUOTA_EMPTY = "empty"

SCRAPERAPI_STATUS_URL = "https://api.scraperapi.com/account?api_key={key}"


def get_remaining_credits() -> int:
    """
    Fetch remaining ScraperAPI credits from the account API.
    Returns -1 on any failure (connection error, bad key, etc.).
    """
    api_key = os.getenv("SCRAPERAPI_KEY", "")
    if not api_key:
        log.warning("SCRAPERAPI_KEY not set — cannot check quota")
        return -1

    try:
        resp = requests.get(
            SCRAPERAPI_STATUS_URL.format(key=api_key),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        # API returns: {"requestCount": 974, "requestLimit": 1000, ...}
        limit     = int(data.get("requestLimit", 0))
        used      = int(data.get("requestCount", 0))
        remaining = max(0, limit - used)
        log.info(f"ScraperAPI credits: {remaining} remaining ({used}/{limit} used)")
        return remaining
    except requests.RequestException as e:
        log.error(f"ScraperAPI quota check failed: {e}")
        return -1
    except (KeyError, ValueError, TypeError) as e:
        log.error(f"ScraperAPI quota response parse error: {e}")
        return -1


def check_scraperapi_quota(alert_telegram: bool = True) -> str:
    """
    Check quota and return QUOTA_OK | QUOTA_LOW | QUOTA_EMPTY.

    If alert_telegram=True and quota is LOW or EMPTY, sends an admin Telegram
    message so the owner can take action before the next run.

    Returns:
        QUOTA_OK    — Enough credits to run (>= MIN_CREDITS_THRESHOLD)
        QUOTA_LOW   — Credits below threshold but > 0 (still runs, but alerts)
        QUOTA_EMPTY — No credits left (0) or check failed (-1) — SKIPS run
    """
    remaining = get_remaining_credits()

    if remaining < 0:
        # Check failed — treat as empty to be safe
        log.warning("ScraperAPI quota check failed — treating as EMPTY (safe default)")
        _send_telegram_alert(
            "⚠️ ScraperAPI Quota Check FAILED\n\n"
            "Could not fetch credit balance.\n"
            "Myntra/Nykaa scrapers SKIPPED this run.\n"
            "Check: https://app.scraperapi.com"
        )
        return QUOTA_EMPTY

    if remaining == 0:
        log.error("ScraperAPI credits EXHAUSTED — Myntra/Nykaa scrapers will be skipped")
        if alert_telegram:
            _send_telegram_alert(
                "🔴 ScraperAPI Credits EXHAUSTED (0 remaining)\n\n"
                "Myntra + Nykaa scrapers SKIPPED this run.\n"
                "Action: Wait for monthly reset or register authorized account.\n"
                "https://app.scraperapi.com"
            )
        return QUOTA_EMPTY

    if remaining < MIN_CREDITS_THRESHOLD:
        log.warning(
            f"ScraperAPI credits LOW: {remaining} remaining "
            f"(threshold: {MIN_CREDITS_THRESHOLD}) — running this time but alerting"
        )
        if alert_telegram:
            runs_left = remaining // CREDITS_PER_RUN_ESTIMATE
            _send_telegram_alert(
                f"⚠️ ScraperAPI Credits LOW: {remaining} remaining\n\n"
                f"Estimated credits per run: ~{CREDITS_PER_RUN_ESTIMATE}\n"
                f"Approximately {runs_left} run(s) left before exhaustion.\n"
                f"Action needed: Restore quota before next scheduled run.\n"
                f"https://app.scraperapi.com"
            )
        return QUOTA_LOW

    return QUOTA_OK


def _send_telegram_alert(message: str) -> None:
    """Send a quota alert to the admin Telegram chat (best-effort, never raises)."""
    bot_token     = os.getenv("TELEGRAM_BOT_TOKEN", "")
    admin_chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")

    if not bot_token or not admin_chat_id:
        log.debug("Telegram admin credentials not set — skipping quota alert")
        return

    try:
        import requests as _req
        _req.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": admin_chat_id, "text": f"[ShadowMerchant]\n\n{message}"},
            timeout=10,
        )
    except Exception as e:
        log.debug(f"Telegram quota alert send failed: {e}")


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    result    = check_scraperapi_quota(alert_telegram=False)
    remaining = get_remaining_credits()
    print(f"Quota status : {result.upper()}")
    print(f"Credits left : {remaining}")
    sys.exit(0 if result == QUOTA_OK else 1)
