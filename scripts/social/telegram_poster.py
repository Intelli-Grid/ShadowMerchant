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

import random

from datetime import datetime, timedelta, timezone

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

#  PART 1 — DEDUPLICATION ENGINE

# ═══════════════════════════════════════════════════════════════



def mark_deals_as_posted(db, deal_ids: list, channel_id: str = None):

    channel_id = channel_id or CHANNEL_ID

    now        = datetime.now(timezone.utc)

    try:

        import pymongo

        db.telegram_post_log.bulk_write([

            pymongo.UpdateOne(

                {"deal_id": str(did), "channel_id": channel_id},

                {"$set": {

                    "deal_id":    str(did),

                    "channel_id": channel_id,

                    "posted_at":  now,

                    "expires_at": now + timedelta(hours=24),

                }},

                upsert=True

            )

            for did in deal_ids

        ])

        db.telegram_post_log.delete_many({"expires_at": {"$lt": now}})

    except Exception as e:

        logger.error(f"Post log write failed: {e}")



def get_recently_posted_ids(db, channel_id: str = None, hours: int = 24) -> set:

    channel_id = channel_id or CHANNEL_ID

    cutoff     = datetime.now(timezone.utc) - timedelta(hours=hours)

    try:

        docs = db.telegram_post_log.find(

            {"channel_id": channel_id, "posted_at": {"$gte": cutoff}},

            {"deal_id": 1}

        )

        return {str(d["deal_id"]) for d in docs}

    except Exception:

        return set()



def get_fresh_deals(db, limit: int = 10, category: str = None,

                    min_score: int = 40, platform: str = None,

                    exclude_ids: set = None) -> list:

    exclude_ids = exclude_ids or get_recently_posted_ids(db)

    query = {"is_active": True}

    if category: query["category"] = category

    if platform: query["source_platform"] = platform

    if min_score > 0: query["deal_score"] = {"$gte": min_score}

    

    if exclude_ids:

        import bson

        object_ids, string_ids = [], []

        for did in exclude_ids:

            try: object_ids.append(bson.ObjectId(did))

            except Exception: string_ids.append(did)

        if object_ids:

            query["_id"] = {"$nin": object_ids}



    deals = list(db.deals.find(query).sort("deal_score", -1).limit(limit * 3))

    if len(deals) > limit:

        top_cut = max(1, limit // 3)

        top_deals, rest_deals = deals[:top_cut], deals[top_cut:]

        random.shuffle(rest_deals)

        deals = top_deals + rest_deals

    return deals[:limit]



def _get_top_deals(db, limit: int = 5) -> list:

    return list(db.deals.find({"is_active": True, "is_pro_exclusive": False}).sort("deal_score", -1).limit(limit))



def _get_trending_deals(db, limit: int = 3) -> list:

    return list(db.deals.find({"is_active": True, "is_trending": True}).sort("deal_score", -1).limit(limit))



# ═══════════════════════════════════════════════════════════════

#  PART 2 — MESSAGE FORMATTERS

# ═══════════════════════════════════════════════════════════════



def _savings(deal: dict) -> str:

    orig, disc = deal.get("original_price", 0), deal.get("discounted_price", 0)

    saved = orig - disc

    return f"₹{saved:,.0f}" if saved > 0 else ""



def format_deal_personal(deal: dict) -> str:

    title, disc, pct, platform, deal_id = deal.get("title", "Unknown Deal")[:70], deal.get("discounted_price", 0), deal.get("discount_percent", 0), deal.get("source_platform", "").capitalize(), str(deal.get("_id", ""))

    return (f"🔔 *Your Deal Alert Matched!*\n\n📦 {title}\n\n💰 *₹{disc:,.0f}* — {pct}% OFF on {platform}\n\n👉 [View Deal]({APP_URL}/deals/{deal_id})")



def format_pipeline_report(stats: dict) -> str:

    scrapers  = stats.get("scrapers", {})
    total     = stats.get("total_collected", 0)
    saved     = stats.get("saved", 0)
    elapsed   = stats.get("elapsed_seconds", 0)
    run_at    = stats.get("run_at", "unknown")

    # ── scraper-level lines (with optional timing) ────────────────────
    scraper_lines = []
    dead_scrapers = []
    scraper_times = stats.get("scraper_times", {})
    for name, count in scrapers.items():
        icon = "✅" if count > 0 else "❌"
        t = scraper_times.get(name)
        time_suffix = f" · {t}s" if t is not None else ""
        scraper_lines.append(f"  {icon} {name}: {count} deals{time_suffix}")
        if count == 0:
            dead_scrapers.append(name)

    working   = len(scrapers) - len(dead_scrapers)
    total_sc  = len(scrapers)

    # ── health classification ─────────────────────────────────────────
    save_rate = round((saved / total * 100)) if total > 0 else 0
    if working == 0 or saved == 0:
        health = "🔴 CRITICAL — all scrapers returned 0 deals"
    elif working < total_sc / 2:
        health = f"🟠 DEGRADED — only {working}/{total_sc} scrapers active"
    elif save_rate < 15:
        health = f"🟡 LOW YIELD — save rate only {save_rate}%"
    else:
        health = "✅ Pipeline healthy"

    # ── dead-scraper callout ─────────────────────────────────────────
    dead_note = ""
    if dead_scrapers:
        dead_note = f"\n⚠️ Dead scrapers: {', '.join(dead_scrapers)} — check proxy/API"

    efficiency = f" ({save_rate}% save rate)" if total > 0 else ""

    return (
        f"📊 *Pipeline Report*\n"
        f"🕐 {str(run_at)[:19]}\n\n"
        + "\n".join(scraper_lines) +
        f"\n\n"
        f"📦 Collected: {total} | 💾 Saved: {saved}{efficiency}\n"
        f"⏱️ Duration: {elapsed}s\n"
        f"{dead_note}\n\n"
        f"{health}"
    )



def format_deal_compact(deal: dict) -> str:

    title, disc, pct, platform, deal_id = deal.get("title", "")[:55], deal.get("discounted_price", 0), deal.get("discount_percent", 0), deal.get("source_platform", "").capitalize(), str(deal.get("_id", ""))

    return f"• [{title}...]({APP_URL}/deals/{deal_id}) — *₹{disc:,.0f}* ({pct}% OFF) · {platform}"



def format_flash_deal(deal: dict) -> str:

    title = deal.get("title", "")[:70]

    orig = deal.get("original_price", 0)

    disc = deal.get("discounted_price", 0)

    pct = deal.get("discount_percent", 0)

    platform = deal.get("source_platform", "").capitalize()

    deal_id = str(deal.get("_id", ""))

    score = deal.get("deal_score", 0)

    rating = deal.get("rating", 0)

    rating_c = deal.get("rating_count", 0)

    is_trending = deal.get("is_trending", False)

    

    saved = orig - disc

    rating_str = f"⭐ Rating: {rating:.1f}/5 ({rating_c:,}+ reviews)" if rating > 0 else "⭐ Rating: Not available"

    trending_str = "\n🔥 TRENDING — Grabbed multiple times today" if is_trending else ""

    history_str = "\n📉 Algorithm confirms: Historical LOW price" if score > 85 else "\n📉 Algorithm confirms: Good price drop"

    

    utm = "?utm_source=telegram&utm_medium=channel&utm_campaign=deal_post"

    

    return (

        f"🔴 [SCORE: {score}/100] {'HISTORICAL LOW' if score > 85 else 'PRICE DROP'}\n\n"

        f"🛍️ *{title}*\n"

        f"💰 ~~₹{orig:,.0f}~~ → *₹{disc:,.0f}* — *{pct}% OFF*\n"

        f"{rating_str}\n"

        f"🏪 {platform}\n"

        f"{trending_str}{history_str}\n\n"

        f"⏰ Limited stock. Act fast.\n\n"

        f"👉 [Grab This Deal]({APP_URL}/api/go/{deal_id}{utm})\n"

        f"🔔 [Get Alerts for Your Keywords]({APP_URL}{utm})\n\n"

        f"───────────────────\n"

        f"📢 Share to save a friend ₹{saved:,.0f} today"

    )



def format_deal_of_the_day(deal: dict) -> str:

    title, orig, disc, pct, rating, rating_c, platform, category, deal_id, score, saved = deal.get("title", "")[:80], deal.get("original_price", 0), deal.get("discounted_price", 0), deal.get("discount_percent", 0), deal.get("rating", 0), deal.get("rating_count", 0), deal.get("source_platform", "").capitalize(), deal.get("category", "").capitalize(), str(deal.get("_id", "")), deal.get("deal_score", 0), _savings(deal)

    rating_str = f"⭐ {rating:.1f} ({rating_c:,} ratings)" if rating > 0 else ""

    return (f"🌟 *DEAL OF THE DAY* 🌟\n━━━━━━━━━━━━━━━━━━━━━\n\n*{title}*\n\n💰 ~~₹{orig:,.0f}~~ → *₹{disc:,.0f}*\n🔥 *{pct}% OFF*" + (f" · You save {saved}" if saved else "") + "\n\n" + (f"{rating_str}\n" if rating_str else "") + f"🏪 {platform}  ·  📂 {category}\n🤖 AI Deal Score: *{score}/100*\n\n💡 _Why this is a great deal:_ Our AI detected this is at its lowest price in recent history.\n\n👉 [Buy Now on {platform}]({APP_URL}/api/go/{deal_id})\n📊 [See Full Price History]({APP_URL}/deals/{deal_id})")



def format_category_digest(deals: list, category: str, emoji: str) -> str:

    header = f"{emoji} *Best {category.capitalize()} Deals Right Now*\n━━━━━━━━━━━━━━━━━━━━━\nAI-curated from Amazon, Flipkart & more\n\n"

    lines = [f"{i}\\. [{d.get('title', '')[:50]}...]({APP_URL}/deals/{str(d.get('_id', ''))})\n   *₹{d.get('discounted_price', 0):,.0f}* — {d.get('discount_percent', 0)}% OFF · {d.get('source_platform', '').capitalize()}" for i, d in enumerate(deals[:5], 1)]

    return header + "\n\n".join(lines) + f"\n\n🔔 Never miss a deal → [Set Alert]({APP_URL}/alerts)\n👀 [See All {category.capitalize()} Deals]({APP_URL}/category/{category})"



def format_morning_brief(deals: list, total_active: int) -> str:

    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)

    header = f"☀️ *{'Good morning' if now_ist.hour < 12 else 'Good evening'}! ShadowMerchant Daily Brief*\n📅 {now_ist.strftime('%A, %d %B %Y')}\n━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *{total_active:,} active deals* across 6 platforms\n\n*Today's Top Picks:*\n\n"

    return header + "\n".join([format_deal_compact(d) for d in deals[:5]]) + f"\n\n💡 Pro tip: Set alerts for your favourite brands.\n🌐 [Browse All Deals]({APP_URL}/deals/feed)"



def format_platform_spotlight(deals: list, platform: str, platform_emoji: str) -> str:

    header = f"{platform_emoji} *Best {platform.capitalize()} Deals Today*\n━━━━━━━━━━━━━━━━━━━━━\n\n"

    return header + "\n".join([format_deal_compact(d) for d in deals[:5]]) + f"\n\n👉 [See All {platform.capitalize()} Deals]({APP_URL}/store/{platform.lower()})\n🔔 [Set {platform.capitalize()} Alert]({APP_URL}/alerts)"



# ═══════════════════════════════════════════════════════════════

#  PART 3(a) — SMART POSTING SCHEDULER LOGIC

# ═══════════════════════════════════════════════════════════════



def get_post_type_for_time() -> dict:

    """

    Maps the current IST time to a professional post type.

    Aligned with 7 daily broadcast slots in scheduler.py:



      UTC -> IST       Post Type

      01:30 -> 07:00  ☀️  Morning Brief         (top deals to start the day)

      04:00 -> 09:30  ⚡  Mid-Morning Flash      (quick deal before work begins)

      06:30 -> 12:00  📂  Category Spotlight      (lunchtime category browse)

      09:30 -> 15:00  🏪  Platform Spotlight      (afternoon platform feature)

      12:30 -> 18:00  🔥  Prime Time Flash        (pre-dinner best picks)

      14:30 -> 20:00  📂  Evening Category        (prime evening browsing)

      16:30 -> 22:00  🌙  Late Night Picks        (genuine night-owl deals)

    """

    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)

    hour    = now_ist.hour

    dow     = now_ist.weekday()



    # Rotate across days — only using active working platforms

    cats = [

        ("electronics", "💻"),   # Mon

        ("fashion",     "👗"),   # Tue

        ("beauty",      "💄"),   # Wed

        ("home",        "🏠"),   # Thu

        ("sports",      "🏋️"),   # Fri

        ("health",      "💊"),   # Sat

        ("gaming",      "🎮"),   # Sun

    ]

    plats = [

        ("amazon",  "📦"),   # Mon

        ("meesho",  "🛍️"),   # Tue

        ("myntra",  "👗"),   # Wed

        ("amazon",  "📦"),   # Thu

        ("meesho",  "🛍️"),   # Fri

        ("myntra",  "👗"),   # Sat

        ("amazon",  "📦"),   # Sun

    ]

    cat_slug,  cat_emoji  = cats[dow]

    plat_slug, plat_emoji = plats[dow]



    # ── 06:00–09:59 AM IST → Morning Brief ─────────────────────────

    if 6 <= hour < 10:

        return {"type": "morning_brief", "deals": 5, "min_score": 50}



    # ── 10:00–11:59 AM IST → Mid-Morning Flash ─────────────────────

    elif 10 <= hour < 12:

        return {"type": "flash_batch", "deals": 3, "min_score": 60, "label": "⚡ Mid-Morning Deal"}



    # ── 12:00–14:59 PM IST → Category Spotlight (lunchtime) ────────

    elif 12 <= hour < 15:

        return {"type": "category_spotlight", "deals": 5, "category": cat_slug, "emoji": cat_emoji, "min_score": 40}



    # ── 15:00–17:59 PM IST → Platform Spotlight (afternoon) ────────

    elif 15 <= hour < 18:

        return {"type": "platform_spotlight", "deals": 5, "platform": plat_slug, "emoji": plat_emoji, "min_score": 40}



    # ── 18:00–19:59 PM IST → Prime Time Flash Deal ──────────────────

    elif 18 <= hour < 20:

        return {"type": "flash_batch", "deals": 3, "min_score": 65, "label": "🔥 Prime Time Deal"}



    # ── 20:00–21:59 PM IST → Evening Category Spotlight ────────────

    elif 20 <= hour < 22:

        return {"type": "category_spotlight", "deals": 5, "category": cat_slug, "emoji": cat_emoji, "min_score": 45}



    # ── 22:00 PM – 05:59 AM IST → Genuine Late Night Picks ─────────

    else:

        return {"type": "flash_batch", "deals": 3, "min_score": 55, "label": "🌙 Late Night Deal"}



# ═══════════════════════════════════════════════════════════════

#  PART 4 — BROADCAST FUNCTIONS

# ═══════════════════════════════════════════════════════════════



async def _send_message(bot, text: str, keyboard=None, image_url: str = None):

    from telegram.constants import ParseMode

    try:

        if image_url:

            try:

                await bot.send_photo(chat_id=CHANNEL_ID, photo=image_url, caption=text[:1024], parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)

                return True

            except Exception as e:

                if "parse" in str(e).lower() or "entity" in str(e).lower():

                    try:

                        await bot.send_photo(chat_id=CHANNEL_ID, photo=image_url, caption=text[:1024], reply_markup=keyboard)

                        return True

                    except Exception: pass

                logger.error(f"Send photo failed: {e}")

        await bot.send_message(chat_id=CHANNEL_ID, text=text, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard, disable_web_page_preview=False)

        return True

    except Exception as e:

        if "parse" in str(e).lower() or "entity" in str(e).lower():

            try:

                await bot.send_message(chat_id=CHANNEL_ID, text=text, reply_markup=keyboard, disable_web_page_preview=False)

                return True

            except Exception: pass

        logger.error(f"Send message failed: {e}")

        return False



async def broadcast_smart():

    if not BOT_TOKEN: return

    from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

    db, bot = get_db(), Bot(token=BOT_TOKEN)

    config = get_post_type_for_time()

    recently_posted = get_recently_posted_ids(db, hours=24)

    post_type, min_score, deal_count = config["type"], config.get("min_score", 40), config.get("deals", 5)



    try:

        if post_type == "morning_brief":

            deals = get_fresh_deals(db, limit=deal_count, min_score=min_score, exclude_ids=recently_posted)

            if not deals: return

            msg = format_morning_brief(deals, db.deals.count_documents({"is_active": True}))

            kb = InlineKeyboardMarkup([[InlineKeyboardButton("🔥 See All Deals", url=f"{APP_URL}/deals/feed"), InlineKeyboardButton("🔔 Set Alert", url=f"{APP_URL}/alerts")]])

            await _send_message(bot, msg, keyboard=kb)

            mark_deals_as_posted(db, [str(d["_id"]) for d in deals])



        elif post_type == "category_spotlight":

            cat, emoji = config["category"], config["emoji"]

            deals = get_fresh_deals(db, limit=deal_count, category=cat, min_score=min_score, exclude_ids=recently_posted)

            if not deals:

                deals, cat, emoji = get_fresh_deals(db, limit=deal_count, min_score=min_score, exclude_ids=recently_posted), "today's top", "🔥"

            if deals:

                msg = format_category_digest(deals, cat, emoji)

                kb = InlineKeyboardMarkup([[InlineKeyboardButton(f"Browse {cat.capitalize()}", url=f"{APP_URL}/category/{cat}")], [InlineKeyboardButton("🌐 All Deals", url=f"{APP_URL}/deals/feed"), InlineKeyboardButton("🔔 Alert", url=f"{APP_URL}/alerts")]])

                await _send_message(bot, msg, keyboard=kb)

                mark_deals_as_posted(db, [str(d["_id"]) for d in deals])



        elif post_type == "platform_spotlight":

            plat, emoji = config["platform"], config["emoji"]

            deals = get_fresh_deals(db, limit=deal_count, platform=plat, min_score=min_score, exclude_ids=recently_posted)

            if not deals:

                deals, plat, emoji = get_fresh_deals(db, limit=deal_count, min_score=min_score, exclude_ids=recently_posted), "top", "🔥"

            if deals:

                msg = format_platform_spotlight(deals, plat, emoji)

                kb = InlineKeyboardMarkup([[InlineKeyboardButton(f"All {plat.capitalize()} Deals", url=f"{APP_URL}/store/{plat}")], [InlineKeyboardButton("🌐 All Deals", url=f"{APP_URL}/deals/feed")]])

                await _send_message(bot, msg, keyboard=kb)

                mark_deals_as_posted(db, [str(d["_id"]) for d in deals])



        elif post_type == "flash_batch":

            deals = get_fresh_deals(db, limit=deal_count, min_score=min_score, exclude_ids=recently_posted)

            if not deals: return

            featured = deals[0]

            kb = InlineKeyboardMarkup([[InlineKeyboardButton("🛒 Get This Deal", url=f"{APP_URL}/api/go/{featured['_id']}"), InlineKeyboardButton("📊 See Score", url=f"{APP_URL}/deals/{featured['_id']}")]])

            await _send_message(bot, format_flash_deal(featured), keyboard=kb, image_url=featured.get("image_url", ""))

            await asyncio.sleep(2)

            if len(deals) > 1:
                label = config.get("label", "More Deals")
                await _send_message(bot, f"*{label}*\n\n" + "\n\n".join([format_deal_compact(d) for d in deals[1:]]) + f"\n\n🌐 [Browse All]({APP_URL}/deals/feed)")

            mark_deals_as_posted(db, [str(d["_id"]) for d in deals])

    except Exception as e:

        logger.error(f"Telegram broadcast error: {e}")



async def broadcast_deal_of_day():

    if not BOT_TOKEN: return

    from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

    db, bot = get_db(), Bot(token=BOT_TOKEN)

    deals = get_fresh_deals(db, limit=1, min_score=70, exclude_ids=get_recently_posted_ids(db, hours=48))

    if not deals: return

    deal = deals[0]

    kb = InlineKeyboardMarkup([[InlineKeyboardButton("🛒 Buy Now", url=f"{APP_URL}/api/go/{deal['_id']}"), InlineKeyboardButton("📊 Price History", url=f"{APP_URL}/deals/{deal['_id']}")]])

    await _send_message(bot, format_deal_of_the_day(deal), keyboard=kb, image_url=deal.get("image_url", ""))

    mark_deals_as_posted(db, [str(deal["_id"])], channel_id="dotd")



def ensure_post_log_index():

    db = get_db()

    if db is None: return

    try:

        db.telegram_post_log.create_index([("expires_at", 1)], expireAfterSeconds=0, name="ttl_expires_at", background=True)

        db.telegram_post_log.create_index([("deal_id", 1), ("channel_id", 1)], unique=True, name="unique_deal_channel", background=True)

    except Exception: pass



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





async def post_hot_deals():
    """
    HOT DEAL Trigger — posts only deals with Shadow Score > 90 to the channel.
    Called automatically after each pipeline run by scheduler.py.
    Respects the 24h post-log deduplication to avoid re-posting.
    """
    if not BOT_TOKEN:
        return

    from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

    db  = get_db()
    bot = Bot(token=BOT_TOKEN)

    recently_posted = get_recently_posted_ids(db, hours=24)

    # Only deals with Shadow Score > 90 — the "exceptional" tier
    hot_deals = get_fresh_deals(
        db,
        limit=3,
        min_score=90,
        exclude_ids=recently_posted,
    )

    if not hot_deals:
        logger.info("[HOT DEALS] No deals with score > 90 to post.")
        return

    logger.info(f"[HOT DEALS] Posting {len(hot_deals)} hot deal(s) with score > 90")

    for deal in hot_deals:
        score = deal.get("deal_score", 0)
        deal_id = str(deal.get("_id", ""))
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("🔥 Grab This Deal", url=f"{APP_URL}/api/go/{deal_id}"),
            InlineKeyboardButton("📊 Score Details",  url=f"{APP_URL}/deals/{deal_id}"),
        ]])
        msg = (
            f"🔥 *HOT DEAL ALERT — Score {score}/100*\n\n"
            + format_flash_deal(deal)
        )
        await _send_message(bot, msg, keyboard=kb, image_url=deal.get("image_url", ""))
        await asyncio.sleep(2)

    mark_deals_as_posted(db, [str(d["_id"]) for d in hot_deals])
    logger.info("[HOT DEALS] Broadcast complete.")


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

                # HIGH-06 fix: include x-telegram-bot-secret header.
                # The link-telegram endpoint now requires this to prevent
                # any arbitrary caller from hijacking account links.
                _bot_secret = os.getenv("TELEGRAM_BOT_SECRET", "")

                httpx.post(

                    f"{APP_URL}/api/user/link-telegram",

                    json={"clerkUserId": clerk_id, "telegramChatId": chat_id},

                    headers={"x-telegram-bot-secret": _bot_secret},

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

        base_help = (

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

        )

        if is_admin(update):

            base_help += (

                "🛠️ *Admin Commands*\n"

                "/run — Trigger scraper pipeline\n"

                "/status — Check pipeline status\n"

                "/push — Manual channel broadcast\n"

                "/report — View last scrape log\n\n"

            )

        base_help += f"🌐 [Visit ShadowMerchant]({APP_URL})"

        

        await update.message.reply_text(

            base_help,

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

        if not ADMIN_CHAT_ID: return False

        admin_id_clean = str(ADMIN_CHAT_ID).strip()

        chat_id_clean = str(upd.effective_chat.id).strip()

        user_id_clean = str(upd.effective_user.id).strip() if upd.effective_user else ""

        return chat_id_clean == admin_id_clean or user_id_clean == admin_id_clean



    _pipeline_running = {"flag": False}   # mutable dict acts as a closure-safe lock



    # ── /run [scraper...] ─────────────────────────────────────────

    _run_selections: dict = {}   # chat_id → set of selected scrapers



    ALL_SCRAPERS = [

        ("amazon",   "📦 Amazon"),

        ("meesho",   "🛍️ Meesho"),

        ("flipkart", "🛒 Flipkart"),

        ("myntra",   "👗 Myntra"),

        ("nykaa",    "💄 Nykaa"),

        ("croma",    "📱 Croma"),

    ]



    def _build_scraper_keyboard(selected: set):

        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        rows = []

        for slug, label in ALL_SCRAPERS:

            tick = "✅" if slug in selected else "☐"

            rows.append([InlineKeyboardButton(f"{tick} {label}", callback_data=f"run_toggle_{slug}")])

        rows.append([

            InlineKeyboardButton("▶ Run Selected", callback_data="run_execute"),

            InlineKeyboardButton("⚡ Run All", callback_data="run_all"),

        ])

        rows.append([InlineKeyboardButton("❌ Cancel", callback_data="run_cancel")])

        return InlineKeyboardMarkup(rows)



    async def admin_run(update: Update, context: ContextTypes.DEFAULT_TYPE):

        from telegram.constants import ParseMode

        

        if not is_admin(update):

            await update.message.reply_text("⛔ Admin access only.")

            return



        if _pipeline_running["flag"]:

            await update.message.reply_text(

                "⚠️ *Pipeline already running.*\n"

                "Use /status to check progress. Wait for the report before triggering again.",

                parse_mode=ParseMode.MARKDOWN

            )

            return



        chat_id = str(update.effective_chat.id)

        args = context.args

        valid = [s for s, _ in ALL_SCRAPERS]



        if args:

            scrapers = [s.lower() for s in args if s.lower() in valid]

            if scrapers:

                await _start_pipeline_run(update, context, scrapers)

                return



        _run_selections[chat_id] = set()

        keyboard = _build_scraper_keyboard(_run_selections[chat_id])

        await update.message.reply_text(

            "🔧 *Select Scrapers to Run*\n\n"

            "Tap to toggle each scraper on/off, then press *▶ Run Selected*.\n\n"

            "_Tip: Press ⚡ Run All to run every scraper at once._",

            parse_mode=ParseMode.MARKDOWN,

            reply_markup=keyboard

        )



    async def handle_run_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):

        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        from telegram.constants import ParseMode

        query = update.callback_query

        await query.answer()



        if not is_admin(update):

            await query.edit_message_text("⛔ Admin access only.")

            return



        chat_id = str(update.effective_chat.id)

        data = query.data



        if data == "run_cancel":

            _run_selections.pop(chat_id, None)

            await query.edit_message_text("❌ Run cancelled.")

            return



        if data == "run_all":

            scrapers = [s for s, _ in ALL_SCRAPERS]

            await query.edit_message_text(

                f"⚡ *Running all {len(scrapers)} scrapers...*\n"

                f"You'll get a report for each one as it completes.",

                parse_mode=ParseMode.MARKDOWN

            )

            await _start_pipeline_run(update, context, scrapers, query=query)

            return



        if data == "run_execute":

            selected = _run_selections.get(chat_id, set())

            if not selected:

                await query.answer("⚠️ Select at least one scraper first!", show_alert=True)

                return

            scrapers = [s for s, _ in ALL_SCRAPERS if s in selected]

            await query.edit_message_text(

                f"▶ *Starting pipeline...*\n"

                f"Scrapers: {', '.join(f'`{s}`' for s in scrapers)}\n\n"

                f"_You'll get a live report after each scraper completes._",

                parse_mode=ParseMode.MARKDOWN

            )

            _run_selections.pop(chat_id, None)

            await _start_pipeline_run(update, context, scrapers, query=query)

            return



        if data.startswith("run_toggle_"):

            slug = data[len("run_toggle_"):]

            if chat_id not in _run_selections:

                _run_selections[chat_id] = set()

            if slug in _run_selections[chat_id]:

                _run_selections[chat_id].discard(slug)

            else:

                _run_selections[chat_id].add(slug)



            selected = _run_selections[chat_id]

            count = len(selected)

            header = (

                f"🔧 *Select Scrapers to Run*\n\n"

                f"{'✅ ' + str(count) + ' selected' if count else '☐ None selected — tap to add'}\n\n"

                "_Press ▶ Run Selected when ready._"

            )

            try:

                await query.edit_message_text(

                    header, parse_mode=ParseMode.MARKDOWN, reply_markup=_build_scraper_keyboard(selected)

                )

            except Exception:

                pass





    async def _start_pipeline_run(update, context, scrapers: list[str], query=None):

        from telegram.constants import ParseMode



        _pipeline_running["flag"] = True



        async def send_admin(text: str):

            try:

                await app.bot.send_message(chat_id=ADMIN_CHAT_ID, text=text, parse_mode=ParseMode.MARKDOWN)

            except Exception as e:

                logger.error(f"Admin send failed: {e}")



        async def _run():

            import sys as _sys

            from pathlib import Path as _Path

            _sys.path.insert(0, str(_Path(__file__).parent.parent))



            SCRAPER_MAP = {

                "amazon":   ("scrapers.amazon_scraper",   "AmazonScraper"),

                "flipkart": ("scrapers.flipkart_scraper", "FlipkartScraper"),

                "myntra":   ("scrapers.myntra_scraper",   "MyntraScraper"),

                "meesho":   ("scrapers.meesho_scraper",   "MeeshoScraper"),

                "nykaa":    ("scrapers.nykaa_scraper",    "NykaaScraper"),

                "croma":    ("scrapers.croma_scraper",    "CromaScraper"),

            }



            await send_admin(

                f"🚀 *Pipeline Started*\n"

                f"Scrapers queued: {' · '.join(f'`{s}`' for s in scrapers)}\n"

                f"🕐 {datetime.now().strftime('%H:%M:%S')}"

            )



            all_deals = []

            scraper_stats = {}

            loop = asyncio.get_event_loop()



            for name in scrapers:

                if name not in SCRAPER_MAP: continue

                module_path, class_name = SCRAPER_MAP[name]

                scraper_start = datetime.utcnow()



                await send_admin(f"⏳ *Running {name} scraper...*")



                try:

                    import importlib

                    mod = importlib.import_module(module_path)

                    cls = getattr(mod, class_name)

                    scraper_obj = cls()



                    deals = await loop.run_in_executor(None, scraper_obj.scrape_deals)

                    all_deals.extend(deals)

                    scraper_stats[name] = len(deals)



                    elapsed = int((datetime.utcnow() - scraper_start).total_seconds())

                    status_icon = "✅" if len(deals) > 0 else "❌"

                    

                    sample_lines = ""

                    if deals:

                        def _get_val(obj, fld, default=None): return getattr(obj, fld, default) if not isinstance(obj, dict) else obj.get(fld, default)

                        for d in deals[:3]:

                            t = str(_get_val(d, 'title', ''))[:45]

                            p = _get_val(d, 'discounted_price', 0)

                            pct = _get_val(d, 'discount_percent', None)

                            if pct is None:

                                op = _get_val(d, 'original_price', 0)

                                pct = int((1 - p / op) * 100) if op > p > 0 else 0

                            sample_lines += f"\n  • {t}... ₹{p:,.0f} ({pct}% off)"



                    await send_admin(

                        f"{status_icon} *{name.capitalize()} Complete*\n"

                        f"📦 {len(deals)} deals · ⏱️ {elapsed}s"

                        + (f"\n\n*Sample:*{sample_lines}" if sample_lines else "")

                    )



                except Exception as e:

                    scraper_stats[name] = 0

                    elapsed = int((datetime.utcnow() - scraper_start).total_seconds())

                    await send_admin(f"❌ *{name.capitalize()} Failed*\n⏱️ {elapsed}s\nError: `{str(e)[:200]}`")

                    logger.error(f"[TELEGRAM RUN] {name} failed: {e}")



            await send_admin(f"💾 *Saving {len(all_deals)} deals to database...*")



            try:

                import os, pymongo, uuid

                from processors.deduplicator import deduplicate_deals

                from processors.deal_scorer import score_deal_with_breakdown

                

                deduped = deduplicate_deals(all_deals)

                db_client = pymongo.MongoClient(os.getenv("MONGO_URI") or os.getenv("MONGODB_URI"))

                temp_db = db_client.shadowmerchant



                saved = 0

                for deal in deduped:

                    try:

                        deal_score, score_breakdown = score_deal_with_breakdown(deal)

                        def _f(fld, default=""): return getattr(deal, fld, default) if not isinstance(deal, dict) else deal.get(fld, default)

                        title, platform, url, img, cat = str(_f("title", "")).strip(), str(_f("platform", "unk")), str(_f("product_url", "")).strip(), str(_f("image_url", "")).strip(), str(_f("category", "other"))

                        orig, disc = float(_f("original_price", 0) or 0), float(_f("discounted_price", 0) or 0)

                        disc_pct = int(round((1 - disc / orig) * 100)) if orig > disc > 0 else 0

                        if not title or disc <= 0 or not url or disc_pct < 10 or disc < 200: continue



                        doc = {

                            "title": title, "source_platform": platform, "original_price": orig, "discounted_price": disc,

                            "discount_percent": disc_pct, "deal_score": int(deal_score), "score_breakdown": score_breakdown,

                            "affiliate_url": url, "image_url": img, "category": cat, "rating": float(_f("rating", 0)),

                            "rating_count": int(_f("rating_count", 0)), "is_active": True, "is_stale": False, "is_pro_exclusive": False,

                            "scraped_at": datetime.utcnow(), "updated_at": datetime.utcnow()

                        }

                        res = temp_db.deals.update_one(

                            {"affiliate_url": url},

                            {"$set": doc, "$push": {"price_history": {"$each": [{"date": datetime.utcnow(), "price": disc}], "$slice": -30}},

                             "$setOnInsert": {"created_at": datetime.utcnow(), "deal_id": str(uuid.uuid4())}},

                            upsert=True

                        )

                        if res.upserted_id or res.modified_count: saved += 1

                    except Exception: pass

                db_client.close()

            except Exception as e:

                saved = 0

                await send_admin(f"❌ *DB save failed:* `{str(e)[:200]}`")



            scraper_lines = "\n".join(f"  {'✅' if c > 0 else '❌'} {n}: {c} deals" for n, c in scraper_stats.items())

            platform_summary = " · ".join(f"{n}({c})" for n, c in scraper_stats.items() if c > 0) or "none"



            await send_admin(

                f"📊 *Pipeline Complete*\n━━━━━━━━━━━━━━━━━━━━━\n{scraper_lines}\n\n"

                f"📦 Total collected: {len(all_deals)}\n💾 Saved/updated: {saved}\n✅ Working: {platform_summary}\n"

                f"━━━━━━━━━━━━━━━━━━━━━\n{'✅ Pipeline healthy' if saved > 0 else '⚠️ No deals saved'}"

            )



        async def _run_with_cleanup():

            try:

                await _run()

            finally:

                _pipeline_running["flag"] = False



        asyncio.create_task(_run_with_cleanup())





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

            await update.message.reply_text(f"📤 Triggering Smart Broadcast…")

            await broadcast_smart()

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

    async def post_init(application):
        """
        Called by PTB right after the bot connects to Telegram.
        We force-delete any active webhook and wait for Render's old
        instance to shut down before starting polling.
        """
        import asyncio as _asyncio
        logger.info("Bot post_init: clearing stale sessions...")
        try:
            await application.bot.delete_webhook(drop_pending_updates=True)
            logger.info("Webhook cleared successfully.")
        except Exception as e:
            logger.warning(f"Could not delete webhook (may not exist): {e}")

        # Give Render's old instance time to fully release its Telegram long-poll
        # connection after receiving SIGTERM. In practice the old Python process
        # takes ~50s to die cleanly on zero-downtime deploys, so we wait 60s to
        # be safe. The 409 Conflict errors will only appear if we start polling
        # before the old instance has released the connection.
        logger.info("Startup delay: waiting 60s for old Render instance to fully release Telegram polling...")
        await _asyncio.sleep(60)
        logger.info("Bot post_init complete - starting polling.")

    async def conflict_error_handler(update, context):
        """
        Gracefully handle 409 Conflict errors instead of crashing.
        If another instance is still polling, wait 30s and let Render
        eventually kill it naturally.
        """
        from telegram.error import Conflict
        if isinstance(context.error, Conflict):
            logger.warning(
                "Telegram Conflict (409): another bot instance is polling. "
                "Render zero-downtime deploy in progress. Poller will retry in background until old instance dies."
            )
        else:
            logger.error(f"Unhandled bot error: {context.error}", exc_info=context.error)

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()



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



    app.add_handler(CallbackQueryHandler(handle_run_callback, pattern="^run_"))



    app.add_handler(CallbackQueryHandler(button_handler))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, unknown))



    logger.info(f"🤖 ShadowMerchant Bot (@{BOT_USERNAME}) is running... (Ctrl+C to stop)")

    # Register conflict error handler (handles Render zero-downtime 409s)
    app.add_error_handler(conflict_error_handler)

    logger.info(f"Bot ready - starting polling with conflict protection enabled")
    app.run_polling(
        drop_pending_updates=True,
        stop_signals=None,
        read_timeout=20,       # Drop stale connections faster
        write_timeout=20,
        connect_timeout=10,
    )





# ═══════════════════════════════════════════════════════════════

#  BACKWARD-COMPAT WRAPPER (called by scheduler.py)

# ═══════════════════════════════════════════════════════════════



async def post_to_telegram():

    """Backward-compatible function called by scheduler.py after each run."""

    await broadcast_smart()





# ═══════════════════════════════════════════════════════════════

#  ENTRY POINT

# ═══════════════════════════════════════════════════════════════



if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser(description="ShadowMerchant Telegram System")

    parser.add_argument("--broadcast", action="store_true", help="Post top deals to channel")

    parser.add_argument("--setup-db", action="store_true", help="Create DB indexes")

    parser.add_argument("--bot",       action="store_true", help="Run interactive bot daemon")

    parser.add_argument("--report",    action="store_true", help="Send admin pipeline health report")

    parser.add_argument("--limit",     type=int, default=3,  help="Number of deals to broadcast")

    args = parser.parse_args()



    if args.setup_db:

        ensure_post_log_index()

        print("✅ DB indexes created for telegram_post_log")

    elif args.broadcast:

        asyncio.run(broadcast_top_deals(limit=args.limit))

    elif args.bot:

        run_interactive_bot()

    elif args.report:

        db = get_db()

        stats = {

            "scrapers":        {"amazon": 0, "meesho": 0, "flipkart": 0, "myntra": 0},

            "total_collected": db.deals.count_documents({"is_active": True}) if db is not None else 0,

            "saved":           0,

            "elapsed_seconds": 0,

            "run_at":          datetime.utcnow().isoformat(),

        }

        asyncio.run(post_pipeline_report(stats))

    else:

        asyncio.run(broadcast_top_deals(limit=3))

