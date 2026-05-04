"""
Alert Dispatcher — ShadowMerchant
=================================
Checks new deals from the current pipeline run against all active
user Alert documents and dispatches notifications for matches.

Supports alert types:
  - keyword, brand, category, price_drop  (Pro users only)
  - target_price                          (all logged-in users)

Called automatically at end of each scheduler.py pipeline run.

Usage:
    python trigger_alerts.py  # standalone test
"""
import os
import sys
import logging
from datetime import datetime
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
    db = get_db()
    if db is None:
        logger.error("No DB connection for alert dispatch.")
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

    # ── Target Price Alerts ──────────────────────────────────────
    # These are deal-specific and available to ALL logged-in users (not Pro-only).
    # We query ALL active deals (not just new ones) because a deal may have been
    # in the DB already — its price may have changed this run.
    target_price_alerts = list(db.alerts.find({
        "is_active": True,
        "type": "target_price",
    }))
    logger.info(f"Checking {len(target_price_alerts)} target price alerts")

    for alert in target_price_alerts:
        try:
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

            logger.info(
                f"Target price hit: deal={deal_id_str}, "
                f"target=₹{target}, current=₹{current_price}, user={uid}"
            )

            # ── Telegram notification ───────────────────────────
            tg_chat_id = channels.get("telegram", "")
            if tg_chat_id:
                try:
                    import asyncio as _aio
                    from social.telegram_poster import notify_user_alert
                    _aio.run(notify_user_alert(
                        tg_chat_id, matched_deal, "target_price",
                        f"₹{int(target):,}"
                    ))
                    logger.info(f"Target price Telegram alert sent to user {uid}")
                except Exception as e:
                    logger.error(f"Telegram target price alert failed for {uid}: {e}")

            # ── WhatsApp notification ───────────────────────────
            whatsapp_num = channels.get("whatsapp", "")
            if whatsapp_num:
                try:
                    from notifiers.whatsapp_notifier import send_deal_alert
                    send_deal_alert(whatsapp_num, matched_deal)
                    logger.info(f"WhatsApp target price alert sent to user {uid}")
                except Exception as e:
                    logger.error(f"WhatsApp target price alert failed for {uid}: {e}")

            # Deactivate the alert — it has fired
            db.alerts.update_one(
                {"_id": alert["_id"]},
                {"$set": {
                    "is_active": False,
                    "triggered_at": datetime.utcnow(),
                    "last_triggered_at": datetime.utcnow(),
                }}
            )

        except Exception as e:
            logger.error(f"Target price alert processing error: {e}")

    # ── Keyword / Brand / Category / Price Drop Alerts (Pro only) ──
    # Get all active non-target-price alerts
    pro_alerts = list(db.alerts.find({
        "is_active": True,
        "type": {"$ne": "target_price"},
    }))
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
                {"notification_channels": 1, "subscription_tier": 1}
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

            # ── Telegram notification ───────────────────────────
            tg_chat_id = channels.get("telegram", "")
            if tg_chat_id:
                try:
                    import asyncio as _aio
                    from social.telegram_poster import notify_user_alert
                    _aio.run(notify_user_alert(tg_chat_id, best_deal, alert_type, matched_val))
                    logger.info(f"Telegram alert sent to user {user_id}")
                except Exception as e:
                    logger.error(f"Telegram alert failed for {user_id}: {e}")

            # ── WhatsApp notification ───────────────────────────
            whatsapp_num = channels.get("whatsapp", "")
            if whatsapp_num:
                try:
                    from notifiers.whatsapp_notifier import send_deal_alert
                    send_deal_alert(whatsapp_num, best_deal)
                    logger.info(f"WhatsApp alert sent to user {user_id}")
                except Exception as e:
                    logger.error(f"WhatsApp alert failed for {user_id}: {e}")

            # Update last_triggered_at on matched alerts
            for alert, _ in user_matches:
                db.alerts.update_one(
                    {"_id": alert["_id"]},
                    {"$set": {"last_triggered_at": datetime.utcnow()}}
                )

        except Exception as e:
            logger.error(f"Failed to notify user {user_id}: {e}")

    logger.info("Alert dispatch complete.")


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    asyncio.run(dispatch_alerts(datetime.utcnow()))
