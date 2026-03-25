"""
WhatsApp notifier — sends deal alerts via WhatsApp Business API (Meta Cloud API).
Triggered for Pro users who have linked their WhatsApp number.
"""
import os
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


WHATSAPP_API_URL = "https://graph.facebook.com/v19.0/{phone_number_id}/messages"


def send_deal_alert(to_number: str, deal: dict) -> bool:
    """
    Sends a formatted deal alert to a WhatsApp number.
    `to_number` should be in international format: 919876543210
    """
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    token    = os.getenv("WHATSAPP_ACCESS_TOKEN")

    if not phone_id or not token:
        logging.warning("WhatsApp credentials not configured — skipping notification.")
        return False

    title    = deal.get("title", "")[:60]
    disc     = deal.get("discounted_price", 0)
    pct      = deal.get("discount_percent", 0)
    url      = deal.get("affiliate_url", "")
    platform = deal.get("source_platform", "").capitalize()

    message = (
        f"🔥 *ShadowMerchant Alert!*\n\n"
        f"📦 {title}...\n"
        f"💸 *₹{disc:,.0f}* ({pct}% OFF) on {platform}\n\n"
        f"👉 {url}\n\n"
        f"_Reply STOP to unsubscribe_"
    )

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"preview_url": True, "body": message},
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            WHATSAPP_API_URL.format(phone_number_id=phone_id),
            json=payload,
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        logging.info(f"WhatsApp sent to {to_number[-4:]}**: {title[:30]}")
        return True
    except requests.RequestException as e:
        logging.error(f"WhatsApp send failed: {e}")
        return False


def notify_pro_users():
    """Send top deal alerts to all Pro users with WhatsApp linked."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from utils.db import get_db

    db = get_db()
    if db is None:
        return

    top_deal = db.deals.find_one(
        {"is_active": True, "is_pro_exclusive": False},
        sort=[("deal_score", -1)]
    )
    if not top_deal:
        logging.info("No deal to notify about.")
        return

    pro_users = list(db.users.find({
        "subscription_tier": "pro",
        "notification_channels.whatsapp": {"$exists": True, "$ne": ""}
    }))

    logging.info(f"Notifying {len(pro_users)} Pro users via WhatsApp")
    sent = sum(
        1 for u in pro_users
        if send_deal_alert(u["notification_channels"]["whatsapp"], top_deal)
    )
    logging.info(f"✅ WhatsApp: {sent}/{len(pro_users)} messages sent")


if __name__ == "__main__":
    notify_pro_users()
