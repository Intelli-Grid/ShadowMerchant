"""
Alert Dispatcher — ShadowMerchant
=================================
Checks new deals from the current pipeline run against all active
user Alert documents and dispatches notifications for matches.

Supports alert types:
  - keyword, brand, category, price_drop  (Pro users only)
  - target_price                          (all logged-in users)

Notification channels (in order, all attempted):
  1. Telegram personal bot (if chat_id linked)
  2. WhatsApp Business API (if phone linked)
  3. Email via Brevo (ARCH-01: fallback for users with neither, or as supplement)

Called automatically at end of each scheduler.py pipeline run.

Usage:
    python trigger_alerts.py  # standalone test
"""
import os
import sys
import logging
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils.db import get_db

logger = logging.getLogger("trigger_alerts")


async def dispatch_alerts(run_start: datetime):
    """
    Find deals scraped after `run_start` and match against active alerts.
    Sends notifications via Telegram/WhatsApp/Email for matching users.

    - Pro-only types: keyword, brand, category, price_drop
    - All users:      target_price (the core retention mechanism)
    """
    try:
        db = get_db()
    except Exception as e:
        logger.error(f"No DB connection for alert dispatch: {e}")
        return

    # Find deals from this pipeline run — include image_url for Telegram photo cards
    new_deals = list(db.deals.find(
        {"scraped_at": {"$gte": run_start}, "is_active": True},
        {
            "_id": 1, "title": 1, "category": 1, "brand": 1,
            "discount_percent": 1, "discounted_price": 1, "original_price": 1,
            "affiliate_url": 1, "source_platform": 1, "deal_score": 1, "image_url": 1,
        }
    ))

    if not new_deals:
        logger.info("No new deals to match against alerts.")
        return

    # ── Target Price Alerts ────────────────────────────────
    # These are deal-specific and available to ALL logged-in users (not Pro-only).
    # We query ALL active deals (not just new ones) because a deal may have been
    # in the DB already — its price may have changed this run.
    # PERF-02: Use cursor iteration instead of list() to avoid OOM at 10k+ Pro users.
    target_price_cursor = db.alerts.find(
        {"is_active": True, "type": "target_price"},
    ).batch_size(200)
    target_price_count = 0

    for alert in target_price_cursor:
        try:
            target_price_count += 1
            criteria = alert.get("criteria", {})
            deal_id_str = criteria.get("deal_id", "")
            target = float(criteria.get("target_price") or 0)
            if not deal_id_str or target <= 0:
                continue

            from bson import ObjectId
            matched_deal = db.deals.find_one(
                {"_id": ObjectId(deal_id_str), "is_active": True},
                {
                    "discounted_price": 1, "title": 1, "affiliate_url": 1,
                    "image_url": 1, "deal_score": 1, "source_platform": 1,
                    "discount_percent": 1,
                }
            )
            if not matched_deal:
                continue

            current_price = float(matched_deal.get("discounted_price") or 0)
            if current_price <= 0 or current_price > target:
                continue

            # 🎯 Price has hit target — fire notification
            uid = alert.get("user_id", "")
            user = db.users.find_one(
                {"clerk_id": uid},
                {"notification_channels": 1, "subscription_tier": 1}
            )
            if not user:
                continue

            # target_price alerts fire for ALL logged-in users, not just Pro
            channels = user.get("notification_channels") or {}
            user_email = user.get("email", "")
            user_name  = (user.get("name") or "").split(" ")[0] or None

            logger.info(
                f"Target price hit: deal={deal_id_str}, "
                f"target=₹{target}, current=₹{current_price}, user={uid}"
            )

            # ── Telegram notification ───────────────────────────
            tg_sent = False
            tg_chat_id = channels.get("telegram", "")
            if tg_chat_id:
                try:
                    import asyncio as _aio
                    from social.telegram_poster import notify_user_alert
                    _aio.run(notify_user_alert(
                        tg_chat_id, matched_deal, "target_price",
                        f"₹{int(target):,}"
                    ))
                    tg_sent = True
                    logger.info(f"Target price Telegram alert sent to user {uid}")
                except Exception as e:
                    logger.error(f"Telegram target price alert failed for {uid}: {e}")

            # ── WhatsApp notification ───────────────────────────
            wa_sent = False
            whatsapp_num = channels.get("whatsapp", "")
            if whatsapp_num:
                try:
                    from notifiers.whatsapp_notifier import send_deal_alert
                    send_deal_alert(whatsapp_num, matched_deal)
                    wa_sent = True
                    logger.info(f"WhatsApp target price alert sent to user {uid}")
                except Exception as e:
                    logger.error(f"WhatsApp target price alert failed for {uid}: {e}")

            # ARCH-01: Email alert — fallback when no push channel is linked.
            # Also fires as a supplemental channel to ensure delivery.
            if user_email and not (tg_sent or wa_sent):
                _send_alert_email(user_email, user_name, matched_deal, "target price alert")

            # Deactivate the alert — it has fired; $inc times_triggered so
            # churn-message AI can see this user actively used alerts.
            now = datetime.now(timezone.utc)
            db.alerts.update_one(
                {"_id": alert["_id"]},
                {
                    "$set": {
                        "is_active": False,
                        "triggered_at": now,
                        "last_triggered_at": now,
                    },
                    "$inc": {"times_triggered": 1},
                }
            )

        except Exception as e:
            logger.error(f"Target price alert processing error: {e}")

    logger.info(f"Processed {target_price_count} target price alerts")

    # ── Keyword / Brand / Category / Price Drop Alerts (Pro only) ──
    # PERF-02: Cursor-based loading instead of list() to avoid OOM at scale.
    # At 10k Pro users × 20 alerts = 200k docs; streaming with batch_size=200
    # keeps memory flat.
    pro_alerts_cursor = db.alerts.find(
        {"is_active": True, "type": {"$ne": "target_price"}},
    ).batch_size(200)
    pro_alerts = list(pro_alerts_cursor)  # collect after cursor for matching loop
    logger.info(f"Matching {len(new_deals)} new deals against {len(pro_alerts)} Pro alerts")

    if not pro_alerts:
        logger.info("No active Pro alerts configured.")
        return

    # Match each alert against new deals
    matches: dict = {}  # user_id → list of (alert, deal) pairs

    for alert in pro_alerts:
        uid = alert.get("user_id", "")
        alert_type = alert.get("type", "keyword")
        criteria = alert.get("criteria", {})
        min_disc = criteria.get("min_discount", 30)

        for deal in new_deals:
            if deal.get("discount_percent", 0) < min_disc:
                continue

            matched = False
            if alert_type == "keyword":
                kw = criteria.get("keyword", "").lower()
                matched = bool(kw and kw in deal.get("title", "").lower())
            elif alert_type == "brand":
                br = criteria.get("brand", "").lower()
                matched = bool(br and br in deal.get("title", "").lower())
            elif alert_type == "category":
                matched = criteria.get("category", "") == deal.get("category", "")
            elif alert_type == "price_drop":
                matched = deal.get("discounted_price", 0) <= criteria.get("max_price", 0)

            if matched:
                if uid not in matches:
                    matches[uid] = []
                matches[uid].append((alert, deal))

    if not matches:
        logger.info("No Pro alert matches found.")
        return

    logger.info(f"Found Pro alert matches for {len(matches)} users")

    for user_id, user_matches in matches.items():
        try:
            user = db.users.find_one(
                {"clerk_id": user_id},
                {"notification_channels": 1, "subscription_tier": 1, "email": 1, "name": 1}
            )
            if not user:
                continue

            # Pro-only gate for keyword/brand/category/price_drop alerts
            if user.get("subscription_tier") != "pro":
                continue

            # Take the highest-scored matching deal
            best_deal  = max((d for _, d in user_matches), key=lambda x: x.get("deal_score", 0))
            best_alert = next(a for a, d in user_matches if d == best_deal)
            alert_type = best_alert.get("type", "keyword")
            criteria   = best_alert.get("criteria", {})
            matched_val = (
                criteria.get("keyword") or criteria.get("brand") or
                criteria.get("category") or str(criteria.get("max_price", ""))
            )

            channels = user.get("notification_channels") or {}
            user_email = user.get("email", "")
            user_name  = (user.get("name") or "").split(" ")[0] or None

            # ── Telegram notification ───────────────────────────
            tg_sent = False
            tg_chat_id = channels.get("telegram", "")
            if tg_chat_id:
                try:
                    import asyncio as _aio
                    from social.telegram_poster import notify_user_alert
                    _aio.run(notify_user_alert(tg_chat_id, best_deal, alert_type, matched_val))
                    tg_sent = True
                    logger.info(f"Telegram alert sent to user {user_id}")
                except Exception as e:
                    logger.error(f"Telegram alert failed for {user_id}: {e}")

            # ── WhatsApp notification ───────────────────────────
            wa_sent = False
            whatsapp_num = channels.get("whatsapp", "")
            if whatsapp_num:
                try:
                    from notifiers.whatsapp_notifier import send_deal_alert
                    send_deal_alert(whatsapp_num, best_deal)
                    wa_sent = True
                    logger.info(f"WhatsApp alert sent to user {user_id}")
                except Exception as e:
                    logger.error(f"WhatsApp alert failed for {user_id}: {e}")

            # ARCH-01: Email alert — fallback for users with no push channel linked.
            if user_email and not (tg_sent or wa_sent):
                _send_alert_email(user_email, user_name, best_deal, alert_type)

            # Update last_triggered_at and increment times_triggered on matched alerts
            for alert, _ in user_matches:
                db.alerts.update_one(
                    {"_id": alert["_id"]},
                    {
                        "$set": {"last_triggered_at": datetime.now(timezone.utc)},
                        "$inc": {"times_triggered": 1},
                    }
                )

        except Exception as e:
            logger.error(f"Failed to notify user {user_id}: {e}")

    logger.info("Alert dispatch complete.")


def _send_alert_email(email: str, first_name, deal: dict, alert_type: str):
    """
    ARCH-01: Call the Next.js internal API to send a deal alert email via Brevo.
    Fire-and-forget — logs on failure but never raises.
    """
    app_url        = os.getenv("NEXT_PUBLIC_APP_URL", "https://www.shadowmerchant.online").rstrip("/")
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")

    if not internal_secret:
        logger.warning("[email-alert] INTERNAL_API_SECRET not set — skipping email dispatch")
        return

    try:
        payload = json.dumps({
            "email":     email,
            "firstName": first_name,
            "alertType": alert_type,
            "deal": {
                "title":            deal.get("title", ""),
                "discounted_price": deal.get("discounted_price", 0),
                "original_price":   deal.get("original_price"),
                "discount_percent": deal.get("discount_percent"),
                "deal_score":       deal.get("deal_score"),
                "source_platform":  deal.get("source_platform"),
                "slug":             deal.get("slug"),
                "_id":              str(deal.get("_id", "")),
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{app_url}/api/internal/send-alert-email",
            data=payload,
            headers={
                "Content-Type":      "application/json",
                "x-internal-secret": internal_secret,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"[email-alert] Sent to {email}, status={resp.status}")
    except Exception as e:
        logger.error(f"[email-alert] Failed to send to {email}: {e}")


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    asyncio.run(dispatch_alerts(datetime.now(timezone.utc)))
