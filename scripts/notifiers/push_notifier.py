"""
Push notification sender via OneSignal REST API.
Sends deal alerts to all subscribed users (web push).

Docs: https://documentation.onesignal.com/reference/create-notification
"""
import os
import sys
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

ONESIGNAL_API = "https://onesignal.com/api/v1/notifications"


def send_push(deal: dict, segment: str = "All") -> bool:
    """
    Sends a web push notification for a deal to a OneSignal segment.
    `segment` can be 'All', 'Active Users', or any custom segment name.
    """
    app_id  = os.getenv("ONESIGNAL_APP_ID")
    api_key = os.getenv("ONESIGNAL_API_KEY")

    if not app_id or not api_key:
        logging.warning("OneSignal credentials not configured — skipping push.")
        return False

    title   = deal.get("title", "")[:60]
    price   = deal.get("discounted_price", 0)
    pct     = deal.get("discount_percent", 0)
    deal_id = str(deal.get("_id", ""))
    url     = f"{os.getenv('NEXT_PUBLIC_APP_URL', 'https://shadowmerchant.in')}/deals/{deal_id}"

    payload = {
        "app_id": app_id,
        "included_segments": [segment],
        "headings": {"en": f"🔥 {pct}% OFF Deal!"},
        "contents": {"en": f"{title[:50]}... — ₹{price:,.0f}"},
        "url": url,
        "web_push_topic": "deal_alert",
        "chrome_web_icon": f"{os.getenv('NEXT_PUBLIC_APP_URL', 'https://shadowmerchant.in')}/logo.png",
    }

    headers = {
        "Authorization": f"Basic {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(ONESIGNAL_API, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        logging.info(f"Push sent — recipients: {data.get('recipients', 0)}, id: {data.get('id')}")
        return True
    except requests.RequestException as e:
        logging.error(f"Push notification failed: {e}")
        return False


def notify_top_deal() -> None:
    """Finds the top-scored deal and pushes a notification."""
    db = get_db()
    if db is None:
        return

    deal = db.deals.find_one(
        {"is_active": True, "is_pro_exclusive": False},
        sort=[("deal_score", -1)]
    )
    if not deal:
        logging.info("No deal to notify about.")
        return

    logging.info(f"Sending push for: {deal.get('title', '')[:50]}")
    send_push(deal)


if __name__ == "__main__":
    notify_top_deal()
