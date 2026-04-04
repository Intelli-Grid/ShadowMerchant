"""
ShadowMerchant — Telegram System
=================================
Handles three distinct functions:
  1. Channel broadcasting — posts top deals to @ShadowMerchantDeals
  2. Admin alerts — sends pipeline health to your private chat
  3. Personal bot — handles user commands and personalized deal alerts

Usage:
  # Broadcast top deals to channel (called automatically by scheduler.py):
  python social/telegram_poster.py --broadcast

  # Run the interactive bot daemon (run this separately, keep it alive):
  python social/telegram_poster.py --bot

  # Send admin health report to your DM:
  python social/telegram_poster.py --report
"""
import os
import sys
import asyncio
import logging
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("telegram")

BOT_TOKEN      = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHANNEL_ID     = os.getenv("TELEGRAM_CHANNEL_ID", "@ShadowMerchantDeals")
ADMIN_CHAT_ID  = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
APP_URL        = os.getenv("NEXT_PUBLIC_APP_URL", "https://www.shadowmerchant.online")
BOT_USERNAME   = "Shadow_Merchant_Bot"


# ═══════════════════════════════════════════════════════════════
#  PART 1 — MESSAGE FORMATTERS
# ═══════════════════════════════════════════════════════════════

def format_deal_channel(deal: dict, rank: int = 1) -> str:
    """Format a deal for the public channel — rich Markdown, emoji, inline CTA."""
    title    = deal.get("title", "Unknown Deal")[:80]
    orig     = deal.get("original_price", 0)
    disc     = deal.get("discounted_price", 0)
    pct      = deal.get("discount_percent", 0)
    score    = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "").capitalize()
    category = deal.get("category", "").capitalize()
    deal_id  = str(deal.get("_id", ""))
    url      = f"{APP_URL}/deals/{deal_id}"

    if score >= 85:
        score_badge = "🔥 EXCEPTIONAL"
    elif score >= 70:
        score_badge = "⭐ GREAT VALUE"
    else:
        score_badge = "✅ GOOD DEAL"

    rank_emoji = {1: "🥇", 2: "🥈", 3: "🥉"}.get(rank, "🏷️")
    savings = orig - disc
    savings_str = f"₹{savings:,.0f}" if savings > 0 else ""

    return (
        f"{rank_emoji} *{title}*\n\n"
        f"💸 ~~₹{orig:,.0f}~~ → *₹{disc:,.0f}*\n"
        f"🏷️ *{pct}% OFF*"
        + (f" · Save {savings_str}" if savings_str else "") + "\n\n"
        f"🏪 {platform}  |  📂 {category}\n"
        f"🤖 AI Score: *{score}/100* — {score_badge}\n\n"
        f"👉 [Get this Deal]({APP_URL}/api/go/{deal_id})\n"
        f"🌐 [Browse All Deals]({APP_URL}/deals/feed)"
    )


def format_deal_personal(deal: dict) -> str:
    """Format a deal for a personal DM alert."""
    title    = deal.get("title", "Unknown Deal")[:70]
    disc     = deal.get("discounted_price", 0)
    pct      = deal.get("discount_percent", 0)
    platform = deal.get("source_platform", "").capitalize()
    deal_id  = str(deal.get("_id", ""))
    return (
        f"🔔 *Your Deal Alert Matched!*\n\n"
        f"📦 {title}\n\n"
        f"💰 *₹{disc:,.0f}* — {pct}% OFF on {platform}\n\n"
        f"👉 [View Deal]({APP_URL}/deals/{deal_id})"
    )


def format_pipeline_report(stats: dict) -> str:
    """Admin-only pipeline health report."""
    scrapers = stats.get("scrapers", {})
    total    = stats.get("total_collected", 0)
    saved    = stats.get("saved", 0)
    elapsed  = stats.get("elapsed_seconds", 0)
    run_at   = stats.get("run_at", "unknown")

    scraper_lines = "\n".join(
        f"  {'✅' if count > 0 else '❌'} {name}: {count} deals"
        for name, count in scrapers.items()
    )
    return (
        f"📊 *Pipeline Report*\n"
        f"🕐 {str(run_at)[:19]}\n\n"
        f"{scraper_lines}\n\n"
        f"📦 Collected: {total} | 💾 Saved: {saved}\n"
        f"⏱️ Duration: {elapsed}s\n\n"
        f"{'✅ Pipeline healthy' if saved > 0 else '⚠️ No deals saved — check logs'}"
    )


# ═══════════════════════════════════════════════════════════════
#  PART 2 — CHANNEL BROADCASTING
# ═══════════════════════════════════════════════════════════════

def _get_top_deals(db, limit: int = 5) -> list:
    return list(
        db.deals
          .find({"is_active": True, "is_pro_exclusive": False})
          .sort("deal_score", -1)
          .limit(limit)
    )


def _get_trending_deals(db, limit: int = 3) -> list:
    return list(
        db.deals
          .find({"is_active": True, "is_trending": True})
          .sort("deal_score", -1)
          .limit(limit)
    )


async def broadcast_top_deals(limit: int = 3):
    """
    Post the top N deals to the public channel.
    Called by scheduler.py after each pipeline run via post_to_telegram().
    """
    if not BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set — skipping broadcast.")
        return

    from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.constants import ParseMode

    db = get_db()
    if db is None:
        logger.error("No DB connection for broadcast.")
        return

    deals = _get_trending_deals(db, limit=limit)
    if not deals:
        deals = _get_top_deals(db, limit=limit)
    if not deals:
        logger.info("No deals to broadcast.")
        return

    bot = Bot(token=BOT_TOKEN)

    header = (
        f"🕐 *Deal Update — {datetime.now().strftime('%I:%M %p IST')}*\n"
        f"Here are today's top {len(deals)} AI-ranked deals 🔥"
    )
    try:
        await bot.send_message(chat_id=CHANNEL_ID, text=header, parse_mode=ParseMode.MARKDOWN)
        await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"Failed to send broadcast header: {e}")
        return

    for i, deal in enumerate(deals, 1):
        try:
            msg       = format_deal_channel(deal, rank=i)
            image_url = deal.get("image_url", "")
            deal_id   = str(deal.get("_id", ""))

            keyboard = InlineKeyboardMarkup([[
                InlineKeyboardButton("🛒 Get Deal",    url=f"{APP_URL}/api/go/{deal_id}"),
                InlineKeyboardButton("📊 See Score",  url=f"{APP_URL}/deals/{deal_id}"),
            ]])

            if image_url:
                try:
                    await bot.send_photo(
                        chat_id=CHANNEL_ID, photo=image_url, caption=msg,
                        parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard
                    )
                except Exception:
                    await bot.send_message(
                        chat_id=CHANNEL_ID, text=msg,
                        parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard,
                        disable_web_page_preview=False
                    )
            else:
                await bot.send_message(
                    chat_id=CHANNEL_ID, text=msg,
                    parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard,
                    disable_web_page_preview=False
                )

            await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"Failed to post deal #{i}: {e}")

    logger.info(f"✅ Broadcast complete — {len(deals)} deals posted to {CHANNEL_ID}")


# ═══════════════════════════════════════════════════════════════
#  PART 3 — ADMIN ALERTS (private DM to your Telegram)
# ═══════════════════════════════════════════════════════════════

async def post_admin_alert(message: str):
    """Send a plain alert to the admin's private chat."""
    if not BOT_TOKEN or not ADMIN_CHAT_ID:
        logger.warning("Admin alert skipped — BOT_TOKEN or ADMIN_CHAT_ID not set.")
        return

    from telegram import Bot
    from telegram.constants import ParseMode

    bot = Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(
            chat_id=ADMIN_CHAT_ID,
            text=f"🚨 *ShadowMerchant Alert*\n\n{message}",
            parse_mode=ParseMode.MARKDOWN
        )
        logger.info("Admin alert sent.")
    except Exception as e:
        logger.error(f"Admin alert failed: {e}")


async def post_pipeline_report(stats: dict):
    """Send a pipeline completion report to admin's private chat."""
    if not BOT_TOKEN or not ADMIN_CHAT_ID:
        logger.warning("Pipeline report skipped — BOT_TOKEN or ADMIN_CHAT_ID not set.")
        return

    from telegram import Bot
    from telegram.constants import ParseMode

    bot = Bot(token=BOT_TOKEN)
    msg = format_pipeline_report(stats)
    try:
        await bot.send_message(
            chat_id=ADMIN_CHAT_ID, text=msg, parse_mode=ParseMode.MARKDOWN
        )
        logger.info("Pipeline report sent to admin.")
    except Exception as e:
        logger.error(f"Pipeline report failed: {e}")


# ═══════════════════════════════════════════════════════════════
#  PART 4 — PERSONAL ALERT NOTIFICATIONS (DM to individual users)
# ═══════════════════════════════════════════════════════════════

async def notify_user_alert(telegram_chat_id: str, deal: dict, alert_type: str, matched_value: str):
    """
    Send a personalized deal alert to a specific user's Telegram DM.
    Called by trigger_alerts.py when a new deal matches a user's alert.
    """
    if not BOT_TOKEN or not telegram_chat_id:
        return

    from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.constants import ParseMode

    bot     = Bot(token=BOT_TOKEN)
    title   = deal.get("title", "")[:70]
    disc    = deal.get("discounted_price", 0)
    pct     = deal.get("discount_percent", 0)
    platform = deal.get("source_platform", "").capitalize()
    deal_id = str(deal.get("_id", ""))

    match_reason = {
        "keyword":    f'🔍 Matched your keyword: *"{matched_value}"*',
        "brand":      f'🏷️ Matched your brand alert: *{matched_value}*',
        "category":   f'📂 New deal in: *{matched_value.capitalize()}*',
        "price_drop": f'📉 Price is under your target: *₹{matched_value}*',
    }.get(alert_type, "✅ Matched your alert")

    msg = (
        f"🔔 *Deal Alert!*\n\n"
        f"{match_reason}\n\n"
        f"*{title}*\n\n"
        f"💸 *₹{disc:,.0f}* ({pct}% OFF) on {platform}\n\n"
        f"⏰ Prices change fast — act now!"
    )

    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("🛒 Get Deal",      url=f"{APP_URL}/api/go/{deal_id}"),
        InlineKeyboardButton("📊 Full Details",  url=f"{APP_URL}/deals/{deal_id}"),
    ], [
        InlineKeyboardButton("⚙️ Manage Alerts", url=f"{APP_URL}/alerts"),
    ]])

    image_url = deal.get("image_url", "")
    try:
        if image_url:
            await bot.send_photo(
                chat_id=telegram_chat_id, photo=image_url, caption=msg,
                parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=telegram_chat_id, text=msg,
                parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard
            )
    except Exception as e:
        logger.error(f"User notification failed (chat_id={telegram_chat_id}): {e}")


# ═══════════════════════════════════════════════════════════════
#  PART 5 — INTERACTIVE BOT DAEMON
#  Run separately: python social/telegram_poster.py --bot
# ═══════════════════════════════════════════════════════════════

def run_interactive_bot():
    """
    Start the interactive bot daemon that handles user commands.
    Long-running — run in a separate terminal or deploy to Railway.app.
    """
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import (
        Application, CommandHandler, MessageHandler,
        ConversationHandler, CallbackQueryHandler, ContextTypes, filters
    )
    from telegram.constants import ParseMode

    WAIT_ALERT_TYPE, WAIT_ALERT_VALUE, WAIT_ALERT_DISCOUNT = range(3)

    db = get_db()

    # ── /start ──────────────────────────────────────────────────
    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user    = update.effective_user
        chat_id = str(update.effective_chat.id)
        args    = context.args  # e.g. "link_clerk_abc123"

        # Register subscriber
        try:
            db.telegram_subscribers.update_one(
                {"chat_id": chat_id},
                {"$set": {
                    "chat_id": chat_id,
                    "username": user.username or "",
                    "first_name": user.first_name or "",
                    "subscribed": True,
                    "subscribed_at": datetime.utcnow(),
                }},
                upsert=True
            )
        except Exception:
            pass

        # Deep-link: /start link_<clerkUserId> — link web account to Telegram
        if args and args[0].startswith("link_"):
            clerk_id = args[0][5:]
            try:
                import httpx
                httpx.post(
                    f"{APP_URL}/api/user/link-telegram",
                    json={"clerkUserId": clerk_id, "telegramChatId": chat_id},
                    timeout=10
                )
                await update.message.reply_text(
                    "✅ *Telegram connected!*\n\nYour deal alerts will now be delivered here.\n\n"
                    "Use /alert to set up your first alert.",
                    parse_mode=ParseMode.MARKDOWN
                )
                return
            except Exception as e:
                logger.error(f"Link account failed: {e}")

        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔥 Top Deals Now",    callback_data="cmd_deals")],
            [InlineKeyboardButton("🔔 Set Deal Alert",   callback_data="cmd_alert"),
             InlineKeyboardButton("📂 Categories",       callback_data="cmd_categories")],
            [InlineKeyboardButton("✦ Upgrade to Pro",    url=f"{APP_URL}/pro")],
        ])

        welcome = (
            f"👋 Hey {user.first_name}! Welcome to *ShadowMerchant* 🛒\n\n"
            f"I'm your personal AI deal hunter 🤖\n\n"
            f"🔥 I track deals from Amazon, Flipkart, Myntra, Meesho & more\n"
            f"🤖 Every deal is AI-scored (0–100) for true value\n"
            f"🔔 Set custom alerts — I'll DM you the moment a deal matches\n\n"
            f"What would you like to do?"
        )

        await update.message.reply_text(welcome, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)

    # ── /deals ──────────────────────────────────────────────────
    async def show_deals(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.callback_query:
            await update.callback_query.answer()
            send_fn = update.callback_query.message.reply_text
        else:
            send_fn = update.message.reply_text

        deals = _get_top_deals(db, limit=5)
        if not deals:
            await send_fn("😴 No deals right now. Scrapers run every 6 hours — check back soon!")
            return

        await send_fn("⏳ Fetching today's top deals...")

        for i, deal in enumerate(deals, 1):
            title    = deal.get("title", "")[:60]
            disc     = deal.get("discounted_price", 0)
            pct      = deal.get("discount_percent", 0)
            platform = deal.get("source_platform", "").capitalize()
            score    = deal.get("deal_score", 0)
            deal_id  = str(deal.get("_id", ""))

            rank = {1: "🥇", 2: "🥈", 3: "🥉"}.get(i, "🏷️")
            msg = (
                f"{rank} *{title}*\n"
                f"₹{disc:,.0f} · {pct}% OFF · {platform} · Score: {score}/100"
            )
            keyboard = InlineKeyboardMarkup([[
                InlineKeyboardButton("🛒 Get Deal",  url=f"{APP_URL}/api/go/{deal_id}"),
                InlineKeyboardButton("📊 Details",   url=f"{APP_URL}/deals/{deal_id}"),
            ]])
            await send_fn(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
            await asyncio.sleep(0.5)

        await send_fn(
            f"👉 [See all deals on ShadowMerchant]({APP_URL}/deals/feed)",
            parse_mode=ParseMode.MARKDOWN
        )

    # ── /categories ─────────────────────────────────────────────
    async def show_categories(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.callback_query:
            await update.callback_query.answer()
            send_fn = update.callback_query.message.reply_text
        else:
            send_fn = update.message.reply_text

        cats = [
            ("electronics", "💻"), ("fashion", "👗"), ("beauty", "💄"),
            ("home", "🏠"),        ("sports", "🏋️"),  ("books", "📚"),
            ("toys", "🧸"),        ("health", "💊"),   ("automotive", "🚗"),
            ("grocery", "🛒"),     ("travel", "✈️"),   ("gaming", "🎮"),
        ]
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton(f"{emoji} {cat.capitalize()}", url=f"{APP_URL}/category/{cat}")]
            for cat, emoji in cats
        ])
        await send_fn(
            "📂 *Shop by Category*\nTap any category to see AI-ranked deals:",
            parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard
        )

    # ── /alert conversation ──────────────────────────────────────
    async def alert_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.callback_query:
            await update.callback_query.answer()
            send_fn = update.callback_query.message.reply_text
        else:
            send_fn = update.message.reply_text

        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔍 Keyword",    callback_data="alert_keyword"),
             InlineKeyboardButton("🏷️ Brand",      callback_data="alert_brand")],
            [InlineKeyboardButton("📂 Category",   callback_data="alert_category"),
             InlineKeyboardButton("📉 Price Drop", callback_data="alert_price_drop")],
            [InlineKeyboardButton("❌ Cancel",      callback_data="alert_cancel")],
        ])
        await send_fn(
            "🔔 *Create a Deal Alert*\n\n"
            "🔍 *Keyword* — alert for any deal matching a term\n"
            "🏷️ *Brand* — alert for deals from a specific brand\n"
            "📂 *Category* — alert for deals in a category\n"
            "📉 *Price Drop* — alert when price drops below a target",
            parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard
        )
        return WAIT_ALERT_TYPE

    async def alert_type_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        data = query.data

        if data == "alert_cancel":
            await query.message.reply_text("❌ Alert creation cancelled.")
            return ConversationHandler.END

        alert_type = data.replace("alert_", "")
        context.user_data["alert_type"] = alert_type

        prompts = {
            "keyword":    "Type the keyword to watch:\n(e.g. `boAt earbuds`, `Sony headphones`)",
            "brand":      "Type the brand name:\n(e.g. `Apple`, `Samsung`, `boAt`)",
            "category":   "Type the category:\n(`electronics`, `fashion`, `beauty`, `home`, `sports`)",
            "price_drop": "What's your maximum price (₹)?\n(e.g. `1500` for deals under ₹1,500)",
        }
        await query.message.reply_text(
            f"✏️ *{alert_type.replace('_', ' ').title()} Alert*\n\n{prompts[alert_type]}",
            parse_mode=ParseMode.MARKDOWN
        )
        return WAIT_ALERT_VALUE

    async def alert_value_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
        context.user_data["alert_value"] = update.message.text.strip()
        await update.message.reply_text(
            "🎚️ *Minimum discount %?*\n\n"
            "Only alert me when the discount is at least:\n"
            "Reply with a number like `30` for ≥30% off\n"
            "Send /skip for no minimum",
            parse_mode=ParseMode.MARKDOWN
        )
        return WAIT_ALERT_DISCOUNT

    async def alert_discount_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
        text = update.message.text.strip()
        try:
            min_discount = int(text.replace("%", "").strip())
        except ValueError:
            min_discount = 30

        chat_id     = str(update.effective_chat.id)
        alert_type  = context.user_data.get("alert_type", "keyword")
        alert_value = context.user_data.get("alert_value", "")

        criteria = {"min_discount": min_discount}
        if alert_type == "keyword":
            criteria["keyword"] = alert_value
        elif alert_type == "brand":
            criteria["brand"] = alert_value
        elif alert_type == "category":
            criteria["category"] = alert_value.lower()
        elif alert_type == "price_drop":
            try:
                criteria["max_price"] = float(alert_value.replace("₹", "").replace(",", "").strip())
            except ValueError:
                criteria["max_price"] = 5000

        try:
            db.telegram_alerts.insert_one({
                "chat_id":        chat_id,
                "type":           alert_type,
                "criteria":       criteria,
                "is_active":      True,
                "created_at":     datetime.utcnow(),
                "last_triggered": None,
            })
            await update.message.reply_text(
                f"✅ *Alert Created!*\n\n"
                f"Type: {alert_type.replace('_', ' ').title()}\n"
                f"Watch: *{alert_value}*\n"
                f"Min Discount: {min_discount}%\n\n"
                f"I'll DM you the moment a matching deal appears 🔔\n\n"
                f"Manage alerts: /myalerts",
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Alert save failed: {e}")
            await update.message.reply_text("❌ Something went wrong. Try again with /alert")

        context.user_data.clear()
        return ConversationHandler.END

    async def alert_skip_discount(update: Update, context: ContextTypes.DEFAULT_TYPE):
        update.message.text = "0"
        return await alert_discount_received(update, context)

    # ── /myalerts ────────────────────────────────────────────────
    async def my_alerts(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        alerts  = list(db.telegram_alerts.find({"chat_id": chat_id, "is_active": True}))

        if not alerts:
            await update.message.reply_text(
                "📭 You have no active alerts.\n\nCreate one with /alert"
            )
            return

        lines = []
        for i, a in enumerate(alerts, 1):
            criteria = a.get("criteria", {})
            atype    = a.get("type", "keyword")
            val = (
                criteria.get("keyword") or criteria.get("brand") or
                criteria.get("category") or f"under ₹{criteria.get('max_price', 0):,.0f}"
            )
            disc = criteria.get("min_discount", 0)
            lines.append(f"{i}. {atype.title()}: *{val}* (≥{disc}% off)")

        await update.message.reply_text(
            "🔔 *Your Active Alerts:*\n\n" + "\n".join(lines) + "\n\nUse /stopalert to remove one.",
            parse_mode=ParseMode.MARKDOWN
        )

    # ── /stopalert ───────────────────────────────────────────────
    async def stop_alert(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        args    = context.args

        alerts = list(db.telegram_alerts.find({"chat_id": chat_id, "is_active": True}))
        if not alerts:
            await update.message.reply_text("You have no active alerts.")
            return

        if not args:
            lines = [f"{i+1}. {a['type'].title()}: {a.get('criteria', {})}" for i, a in enumerate(alerts)]
            await update.message.reply_text(
                "Which alert to remove? Reply with:\n`/stopalert 1`\n\n" + "\n".join(lines),
                parse_mode=ParseMode.MARKDOWN
            )
            return

        try:
            idx = int(args[0]) - 1
            if 0 <= idx < len(alerts):
                db.telegram_alerts.update_one(
                    {"_id": alerts[idx]["_id"]}, {"$set": {"is_active": False}}
                )
                await update.message.reply_text("✅ Alert removed.")
            else:
                await update.message.reply_text("❌ Invalid number. Use /myalerts to see your list.")
        except (ValueError, IndexError):
            await update.message.reply_text("Use `/stopalert 1` where 1 is the alert number.", parse_mode=ParseMode.MARKDOWN)

    # ── /pro ─────────────────────────────────────────────────────
    async def pro_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("✦ Upgrade to Pro — ₹99/month", url=f"{APP_URL}/pro")
        ]])
        await update.message.reply_text(
            "✦ *ShadowMerchant Pro*\n\n"
            "🆓 Free: all deal links, search, 5 wishlist saves\n\n"
            "✦ Pro includes:\n"
            "📊 30-day price history on every deal\n"
            "🔔 Deal alerts (up to 10 rules)\n"
            "📉 Price drop alerts on wishlist\n"
            "💛 Unlimited wishlist\n\n"
            "Just ₹99/month — less than one coffee ☕\nCancel anytime.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=keyboard
        )

    # ── /help ─────────────────────────────────────────────────────
    async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "🤖 *ShadowMerchant Bot Commands*\n\n"
            "/start — Welcome & subscribe\n"
            "/deals — Today's top 5 deals\n"
            "/alert — Create a new deal alert\n"
            "/myalerts — See your active alerts\n"
            "/stopalert — Remove an alert\n"
            "/categories — Browse by category\n"
            "/pro — Pro membership info\n"
            "/stop — Unsubscribe from all alerts\n"
            "/help — This message\n\n"
            f"🌐 [Visit ShadowMerchant]({APP_URL})",
            parse_mode=ParseMode.MARKDOWN,
            disable_web_page_preview=True
        )

    # ── /stop ─────────────────────────────────────────────────────
    async def unsubscribe(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        db.telegram_subscribers.update_one({"chat_id": chat_id}, {"$set": {"subscribed": False}})
        db.telegram_alerts.update_many({"chat_id": chat_id}, {"$set": {"is_active": False}})
        await update.message.reply_text(
            "👋 You've been unsubscribed. No more deal alerts.\n\nChanged your mind? Send /start anytime."
        )

    # ══════════════════════════════════════════════════════════
    #  ADMIN COMMANDS (only ADMIN_CHAT_ID can use these)
    # ══════════════════════════════════════════════════════════

    def is_admin(upd: "Update") -> bool:
        return ADMIN_CHAT_ID and str(upd.effective_chat.id) == str(ADMIN_CHAT_ID)

    _pipeline_running = {"flag": False}   # mutable dict acts as a closure-safe lock

    # ── /run [scraper...] ─────────────────────────────────────────
    async def admin_run(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_admin(update):
            await update.message.reply_text("⛔ Admin access only.")
            return

        if _pipeline_running["flag"]:
            await update.message.reply_text(
                "⚠️ Pipeline already running. Wait for the report before triggering again."
            )
            return

        args = context.args  # e.g. ["amazon", "meesho"]
        valid = ["amazon", "flipkart", "myntra", "meesho", "nykaa", "croma"]
        scrapers = [s.lower() for s in args if s.lower() in valid] if args else None
        label = ", ".join(scrapers) if scrapers else "amazon · meesho"

        await update.message.reply_text(
            f"⏳ *Pipeline starting…*\n"
            f"Scrapers: `{label}`\n\n"
            f"_This takes 2–5 min. You'll get a report when done._",
            parse_mode=ParseMode.MARKDOWN
        )

        loop = asyncio.get_event_loop()

        async def _run_and_report():
            _pipeline_running["flag"] = True
            try:
                import sys as _sys
                from pathlib import Path as _Path
                _sys.path.insert(0, str(_Path(__file__).parent.parent))
                from scheduler import run_pipeline
                stats = await loop.run_in_executor(None, run_pipeline, scrapers)
                await post_pipeline_report(stats)
            except Exception as e:
                await update.message.reply_text(f"❌ Pipeline error: {str(e)[:300]}")
            finally:
                _pipeline_running["flag"] = False

        asyncio.create_task(_run_and_report())

    # ── /status ───────────────────────────────────────────────────
    async def admin_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_admin(update):
            await update.message.reply_text("⛔ Admin access only.")
            return

        try:
            from datetime import timezone
            active_deals     = db.deals.count_documents({"is_active": True})
            trending_deals   = db.deals.count_documents({"is_trending": True})
            active_alerts    = db.alerts.count_documents({"is_active": True})
            tg_subscribers   = db.telegram_subscribers.count_documents({"subscribed": True})
            tg_alerts        = db.telegram_alerts.count_documents({"is_active": True})

            last_log = db.scrapelogs.find_one({}, sort=[("run_at", -1)])
            if last_log:
                run_at   = last_log.get("run_at", datetime.utcnow())
                ist_hour = run_at.hour + 5
                ist_min  = run_at.minute + 30
                if ist_min >= 60: ist_hour += 1; ist_min -= 60
                if ist_hour >= 24: ist_hour -= 24
                ts = f"{run_at.strftime('%Y-%m-%d')} {ist_hour:02d}:{ist_min:02d} IST"
                elapsed  = last_log.get("elapsed_seconds", 0)
                last_saved = last_log.get("saved", "?")
                scrapers_last = last_log.get("scrapers", {})
                scraper_line = "  ".join(
                    f"{'✅' if v > 0 else '❌'} {k}" for k, v in scrapers_last.items()
                )
            else:
                ts = "No runs yet"
                elapsed = scraper_line = last_saved = "—"

            pipeline_status = "🔄 Running now" if _pipeline_running["flag"] else "💤 Idle"

            await update.message.reply_text(
                f"📡 *ShadowMerchant Status*\n\n"
                f"🗄️ *Database*\n"
                f"  ✅ Active deals: `{active_deals}`\n"
                f"  🔥 Trending deals: `{trending_deals}`\n"
                f"  🔔 Web alerts: `{active_alerts}`\n"
                f"  📬 TG subscribers: `{tg_subscribers}`\n"
                f"  🔔 TG alerts: `{tg_alerts}`\n\n"
                f"⏱️ *Last Pipeline Run*\n"
                f"  🕐 {ts}\n"
                f"  💾 Saved {last_saved} deals in {elapsed}s\n"
                f"  {scraper_line}\n\n"
                f"⚙️ *Pipeline:* {pipeline_status}",
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            await update.message.reply_text(f"❌ Status error: {e}")

    # ── /push [n] — manual channel broadcast ─────────────────────
    async def admin_push(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_admin(update):
            await update.message.reply_text("⛔ Admin access only.")
            return
        try:
            n = int(context.args[0]) if context.args else 3
            n = max(1, min(n, 10))
            await update.message.reply_text(f"📤 Broadcasting top {n} deals to channel…")
            await broadcast_top_deals(limit=n)
            await update.message.reply_text(f"✅ Done — {n} deals posted to {CHANNEL_ID}")
        except Exception as e:
            await update.message.reply_text(f"❌ Broadcast error: {e}")

    # ── /report — last scrape log formatted ──────────────────────
    async def admin_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_admin(update):
            await update.message.reply_text("⛔ Admin access only.")
            return
        try:
            last_log = db.scrapelogs.find_one({}, sort=[("run_at", -1)])
            if not last_log:
                await update.message.reply_text("No pipeline runs logged yet. Use /run to trigger one.")
                return
            stats = {
                "scrapers":        last_log.get("scrapers", {}),
                "total_collected": last_log.get("total_collected", 0),
                "saved":           last_log.get("saved", 0),
                "elapsed_seconds": last_log.get("elapsed_seconds", 0),
                "run_at":          last_log.get("run_at", datetime.utcnow()).isoformat(),
            }
            await post_pipeline_report(stats)
        except Exception as e:
            await update.message.reply_text(f"❌ Report error: {e}")

    # ── Callback router ───────────────────────────────────────────
    async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        data = update.callback_query.data
        if data == "cmd_deals":
            await show_deals(update, context)
        elif data == "cmd_alert":
            await alert_start(update, context)
        elif data == "cmd_categories":
            await show_categories(update, context)

    # ── Unknown message ───────────────────────────────────────────
    async def unknown(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "🤔 I didn't understand that. Try /help for a list of commands."
        )

    # ── BUILD APPLICATION ─────────────────────────────────────────
    app = Application.builder().token(BOT_TOKEN).build()

    alert_conv = ConversationHandler(
        entry_points=[
            CommandHandler("alert", alert_start),
            CallbackQueryHandler(alert_start, pattern="^cmd_alert$"),
        ],
        states={
            WAIT_ALERT_TYPE:     [CallbackQueryHandler(alert_type_selected, pattern="^alert_")],
            WAIT_ALERT_VALUE:    [MessageHandler(filters.TEXT & ~filters.COMMAND, alert_value_received)],
            WAIT_ALERT_DISCOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, alert_discount_received),
                CommandHandler("skip", alert_skip_discount),
            ],
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: ConversationHandler.END)],
    )

    # Public commands
    app.add_handler(CommandHandler("start",      start))
    app.add_handler(CommandHandler("deals",      show_deals))
    app.add_handler(CommandHandler("categories", show_categories))
    app.add_handler(CommandHandler("myalerts",   my_alerts))
    app.add_handler(CommandHandler("stopalert",  stop_alert))
    app.add_handler(CommandHandler("pro",        pro_info))
    app.add_handler(CommandHandler("help",       help_cmd))
    app.add_handler(CommandHandler("stop",       unsubscribe))
    app.add_handler(alert_conv)

    # Admin-only commands (invisible to public users)
    app.add_handler(CommandHandler("run",    admin_run))
    app.add_handler(CommandHandler("status", admin_status))
    app.add_handler(CommandHandler("push",   admin_push))
    app.add_handler(CommandHandler("report", admin_report))

    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, unknown))

    logger.info(f"🤖 ShadowMerchant Bot (@{BOT_USERNAME}) is running... (Ctrl+C to stop)")
    app.run_polling(drop_pending_updates=True)


# ═══════════════════════════════════════════════════════════════
#  BACKWARD-COMPAT WRAPPER (called by scheduler.py)
# ═══════════════════════════════════════════════════════════════

async def post_to_telegram():
    """Backward-compatible function called by scheduler.py after each run."""
    await broadcast_top_deals(limit=3)


# ═══════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ShadowMerchant Telegram System")
    parser.add_argument("--broadcast", action="store_true", help="Post top deals to channel")
    parser.add_argument("--bot",       action="store_true", help="Run interactive bot daemon")
    parser.add_argument("--report",    action="store_true", help="Send admin pipeline health report")
    parser.add_argument("--limit",     type=int, default=3,  help="Number of deals to broadcast")
    args = parser.parse_args()

    if args.broadcast:
        asyncio.run(broadcast_top_deals(limit=args.limit))
    elif args.bot:
        run_interactive_bot()
    elif args.report:
        db = get_db()
        stats = {
            "scrapers":        {"amazon": 0, "meesho": 0, "flipkart": 0, "myntra": 0},
            "total_collected": db.deals.count_documents({"is_active": True}) if db else 0,
            "saved":           0,
            "elapsed_seconds": 0,
            "run_at":          datetime.utcnow().isoformat(),
        }
        asyncio.run(post_pipeline_report(stats))
    else:
        asyncio.run(broadcast_top_deals(limit=3))
