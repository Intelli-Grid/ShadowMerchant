import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Ensure script execution path can find siblings
sys.path.insert(0, str(Path(__file__).parent))

from notifiers.whatsapp_notifier import send_deal_alert
from utils.db import get_db

logger = logging.getLogger("alerts")

async def dispatch_alerts(run_start_time: datetime):
    """
    Checks for deals scraped in the latest run and matches them against user 'alert_preferences'.
    Triggers direct WhatsApp or Email alerts if a match exceeds the user's minimum discount threshold.
    """
    logger.info("⚡ Starting Pro Alert Dispatcher...")
    try:
        db = get_db()
        if db is None:
            logger.error("No database connection. Cannot dispatch alerts.")
            return

        # Find deals created/updated since this scrape execution started (or in the last 2 hours)
        time_threshold = run_start_time - timedelta(hours=2)
        recent_deals = list(db.deals.find({
            "is_active": True,
            "updated_at": {"$gte": time_threshold}
        }))
        
        if not recent_deals:
            logger.info("  No new deals found to trigger alerts for.")
            return

        # Fetch Pro users with active alert preferences configured
        pro_users = list(db.users.find({
            "subscription_tier": "pro",
            "alert_preferences": {"$exists": True}
        }))

        if not pro_users:
            logger.info("  No active Pro users with alerts enabled.")
            return

        alerts_sent = 0

        for user in pro_users:
            prefs = user.get("alert_preferences", {})
            min_discount = prefs.get("min_discount", 30)
            target_categories = prefs.get("categories", [])
            target_platforms = prefs.get("platforms", [])
            
            # Filter matches for the specific user
            matches = []
            for deal in recent_deals:
                if deal.get("discount_percent", 0) < min_discount:
                    continue
                if target_categories and deal.get("category") not in target_categories:
                    continue
                if target_platforms and deal.get("source_platform") not in target_platforms:
                    continue
                matches.append(deal)

            if matches:
                # Multiple deals may match, just select the single highest discount to avoid spam
                matches = sorted(matches, key=lambda x: x.get("discount_percent", 0), reverse=True)
                top_match = matches[0]

                channels = prefs.get("channels", [])
                user_contact = user.get("notification_channels", {})
                whatsapp_num = user_contact.get("whatsapp")

                # Dispatch via WhatsApp Notifier
                if whatsapp_num and ("whatsapp" in channels or not channels):
                    success = send_deal_alert(whatsapp_num, top_match)
                    if success:
                        alerts_sent += 1
        
        logger.info(f"✅ Alert Dispatch completed. Sent {alerts_sent} alerts.")

    except Exception as e:
        logger.error(f"Alert Dispatch Error: {e}")
