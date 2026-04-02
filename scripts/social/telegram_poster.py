import os
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from telegram import Bot
from telegram.constants import ParseMode

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

sys_path = str(Path(__file__).parent.parent)
import sys
sys.path.insert(0, sys_path)
from utils.db import get_db


def get_top_deals(db, limit=3):
    return list(
        db.deals.find({"is_active": True, "is_pro_exclusive": False})
        .sort("deal_score", -1)
        .limit(limit)
    )


def format_deal_message(deal: dict) -> str:
    title = deal.get("title", "Unknown Deal")
    orig = deal.get("original_price", 0)
    disc = deal.get("discounted_price", 0)
    pct = deal.get("discount_percent", 0)
    url = deal.get("affiliate_url", "")
    score = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "").upper()

    return (
        f"🔥 *{title}*\n\n"
        f"🏷️ ~~₹{orig:,.0f}~~ → *₹{disc:,.0f}* `({pct}% OFF)`\n"
        f"🏪 Platform: {platform}\n"
        f"⚡ Deal Score: {score}/100\n\n"
        f"👉 [Grab this deal]({url})\n\n"
        f"_Via @ShadowMerchantDeals_"
    )


async def post_to_telegram():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    channel = os.getenv("TELEGRAM_CHANNEL_ID", "@ShadowMerchantDeals")

    if not token:
        logging.error("TELEGRAM_BOT_TOKEN not set.")
        return

    db = get_db()
    if db is None:
        logging.error("No DB connection.")
        return

    deals = get_top_deals(db)
    if not deals:
        logging.info("No deals found to post.")
        return

    bot = Bot(token=token)
    for deal in deals:
        msg = format_deal_message(deal)
        try:
            image_url = deal.get("image_url")
            if image_url:
                await bot.send_photo(chat_id=channel, photo=image_url, caption=msg, parse_mode=ParseMode.MARKDOWN)
            else:
                await bot.send_message(chat_id=channel, text=msg, parse_mode=ParseMode.MARKDOWN)
            logging.info(f"Posted deal: {deal.get('title', '')[:50]}")
        except Exception as e:
            logging.error(f"Failed to post deal: {e}")


async def post_admin_alert(message: str):
    """Send an admin/system alert to the Telegram channel."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    channel = os.getenv("TELEGRAM_CHANNEL_ID", "@ShadowMerchantDeals")
    if not token:
        logging.warning("TELEGRAM_BOT_TOKEN not set — skipping admin alert.")
        return
    bot = Bot(token=token)
    try:
        await bot.send_message(
            chat_id=channel,
            text=f"🚨 ShadowMerchant Alert\n\n{message}",
            parse_mode=ParseMode.MARKDOWN,
        )
    except Exception as e:
        logging.error(f"Admin alert failed: {e}")


if __name__ == "__main__":
    asyncio.run(post_to_telegram())
