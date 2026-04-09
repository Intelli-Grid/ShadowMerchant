import re
import os

TELEGRAM_POSTER_FILE = r'e:\Awesome Projects\ShadowMerchant\scripts\social\telegram_poster.py'
SCHEDULER_FILE = r'e:\Awesome Projects\ShadowMerchant\scripts\scheduler.py'

# 1. Update telegram_poster.py
with open(TELEGRAM_POSTER_FILE, 'r', encoding='utf-8') as f:
    orig = f.read()

# Add missing imports for the new logic
if 'from datetime import datetime, timedelta, timezone' not in orig:
    orig = orig.replace('from datetime import datetime', 'import random\nfrom datetime import datetime, timedelta, timezone')

# We need to replace the content between PART 1 and PART 3 with our new logic (which handles dedup, formatters, smart cast).
part1_marker = "# ═══════════════════════════════════════════════════════════════\n#  PART 1 — MESSAGE FORMATTERS\n# ═══════════════════════════════════════════════════════════════"
part3_marker = "# ═══════════════════════════════════════════════════════════════\n#  PART 3 — ADMIN ALERTS (private DM to your Telegram)\n# ═══════════════════════════════════════════════════════════════"

new_core_logic = """# ═══════════════════════════════════════════════════════════════
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
    return (f"🔔 *Your Deal Alert Matched!*\\n\\n📦 {title}\\n\\n💰 *₹{disc:,.0f}* — {pct}% OFF on {platform}\\n\\n👉 [View Deal]({APP_URL}/deals/{deal_id})")

def format_pipeline_report(stats: dict) -> str:
    scrapers, total, saved, elapsed, run_at = stats.get("scrapers", {}), stats.get("total_collected", 0), stats.get("saved", 0), stats.get("elapsed_seconds", 0), stats.get("run_at", "unknown")
    scraper_lines = "\\n".join(f"  {'✅' if count > 0 else '❌'} {name}: {count} deals" for name, count in scrapers.items())
    return (f"📊 *Pipeline Report*\\n🕐 {str(run_at)[:19]}\\n\\n{scraper_lines}\\n\\n📦 Collected: {total} | 💾 Saved: {saved}\\n⏱️ Duration: {elapsed}s\\n\\n{'✅ Pipeline healthy' if saved > 0 else '⚠️ No deals saved — check logs'}")

def format_deal_compact(deal: dict) -> str:
    title, disc, pct, platform, deal_id = deal.get("title", "")[:55], deal.get("discounted_price", 0), deal.get("discount_percent", 0), deal.get("source_platform", "").capitalize(), str(deal.get("_id", ""))
    return f"• [{title}...]({APP_URL}/deals/{deal_id}) — *₹{disc:,.0f}* ({pct}% OFF) · {platform}"

def format_flash_deal(deal: dict) -> str:
    title, orig, disc, pct, platform, deal_id, saved = deal.get("title", "")[:70], deal.get("original_price", 0), deal.get("discounted_price", 0), deal.get("discount_percent", 0), deal.get("source_platform", "").capitalize(), str(deal.get("_id", "")), _savings(deal)
    return (f"⚡️ *FLASH DEAL — ACT NOW!* ⚡️\\n\\n*{title}*\\n\\n🔴 ~~₹{orig:,.0f}~~ → *₹{disc:,.0f}*\\n💥 *{pct}% OFF*" + (f" · Saving {saved}" if saved else "") + f"\\n🏪 {platform}\\n\\n⏰ Prices on {platform} change fast. Don't wait!\\n\\n👉 [Grab This Deal]({APP_URL}/api/go/{deal_id})")

def format_deal_of_the_day(deal: dict) -> str:
    title, orig, disc, pct, rating, rating_c, platform, category, deal_id, score, saved = deal.get("title", "")[:80], deal.get("original_price", 0), deal.get("discounted_price", 0), deal.get("discount_percent", 0), deal.get("rating", 0), deal.get("rating_count", 0), deal.get("source_platform", "").capitalize(), deal.get("category", "").capitalize(), str(deal.get("_id", "")), deal.get("deal_score", 0), _savings(deal)
    rating_str = f"⭐ {rating:.1f} ({rating_c:,} ratings)" if rating > 0 else ""
    return (f"🌟 *DEAL OF THE DAY* 🌟\\n━━━━━━━━━━━━━━━━━━━━━\\n\\n*{title}*\\n\\n💰 ~~₹{orig:,.0f}~~ → *₹{disc:,.0f}*\\n🔥 *{pct}% OFF*" + (f" · You save {saved}" if saved else "") + "\\n\\n" + (f"{rating_str}\\n" if rating_str else "") + f"🏪 {platform}  ·  📂 {category}\\n🤖 AI Deal Score: *{score}/100*\\n\\n💡 _Why this is a great deal:_ Our AI detected this is at its lowest price in recent history.\\n\\n👉 [Buy Now on {platform}]({APP_URL}/api/go/{deal_id})\\n📊 [See Full Price History]({APP_URL}/deals/{deal_id})")

def format_category_digest(deals: list, category: str, emoji: str) -> str:
    header = f"{emoji} *Best {category.capitalize()} Deals Right Now*\\n━━━━━━━━━━━━━━━━━━━━━\\nAI-curated from Amazon, Flipkart & more\\n\\n"
    lines = [f"{i}\\. [{d.get('title', '')[:50]}...]({APP_URL}/deals/{str(d.get('_id', ''))})\\n   *₹{d.get('discounted_price', 0):,.0f}* — {d.get('discount_percent', 0)}% OFF · {d.get('source_platform', '').capitalize()}" for i, d in enumerate(deals[:5], 1)]
    return header + "\\n\\n".join(lines) + f"\\n\\n🔔 Never miss a deal → [Set Alert]({APP_URL}/alerts)\\n👀 [See All {category.capitalize()} Deals]({APP_URL}/category/{category})"

def format_morning_brief(deals: list, total_active: int) -> str:
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    header = f"☀️ *{'Good morning' if now_ist.hour < 12 else 'Good evening'}! ShadowMerchant Daily Brief*\\n📅 {now_ist.strftime('%A, %d %B %Y')}\\n━━━━━━━━━━━━━━━━━━━━━\\n\\n🔥 *{total_active:,} active deals* across 6 platforms\\n\\n*Today's Top Picks:*\\n\\n"
    return header + "\\n".join([format_deal_compact(d) for d in deals[:5]]) + f"\\n\\n💡 Pro tip: Set alerts for your favourite brands.\\n🌐 [Browse All Deals]({APP_URL}/deals/feed)"

def format_platform_spotlight(deals: list, platform: str, platform_emoji: str) -> str:
    header = f"{platform_emoji} *Best {platform.capitalize()} Deals Today*\\n━━━━━━━━━━━━━━━━━━━━━\\n\\n"
    return header + "\\n".join([format_deal_compact(d) for d in deals[:5]]) + f"\\n\\n👉 [See All {platform.capitalize()} Deals]({APP_URL}/store/{platform.lower()})\\n🔔 [Set {platform.capitalize()} Alert]({APP_URL}/alerts)"

# ═══════════════════════════════════════════════════════════════
#  PART 3(a) — SMART POSTING SCHEDULER LOGIC
# ═══════════════════════════════════════════════════════════════

def get_post_type_for_time() -> dict:
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    hour, dow = now_ist.hour, now_ist.weekday()
    cats = [("electronics", "💻"), ("fashion", "👗"), ("beauty", "💄"), ("home", "🏠"), ("sports", "🏋️"), ("gaming", "🎮"), ("health", "💊")]
    plats = [("amazon", "📦"), ("meesho", "🛍️"), ("myntra", "👗"), ("nykaa", "💄"), ("flipkart", "🛒"), ("croma", "📱"), ("amazon", "📦")]
    cat_slug, cat_emoji = cats[dow]
    plat_slug, plat_emoji = plats[dow]
    if 5 <= hour < 9: return {"type": "morning_brief", "deals": 5, "min_score": 50, "format": "morning"}
    elif 11 <= hour < 14: return {"type": "category_spotlight", "deals": 5, "category": cat_slug, "emoji": cat_emoji, "min_score": 40}
    elif 17 <= hour < 20: return {"type": "platform_spotlight", "deals": 5, "platform": plat_slug, "emoji": plat_emoji, "min_score": 40}
    else: return {"type": "flash_batch", "deals": 3, "min_score": 55, "format": "flash"}

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
            except Exception: pass
        await bot.send_message(chat_id=CHANNEL_ID, text=text, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard, disable_web_page_preview=False)
        return True
    except Exception as e:
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
                await _send_message(bot, f"🌙 *More Late Night Deals:*\\n\\n" + "\\n\\n".join([format_deal_compact(d) for d in deals[1:]]) + f"\\n\\n🌐 [Browse All]({APP_URL}/deals/feed)")
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
    if not db: return
    try:
        db.telegram_post_log.create_index([("expires_at", 1)], expireAfterSeconds=0, name="ttl_expires_at", background=True)
        db.telegram_post_log.create_index([("deal_id", 1), ("channel_id", 1)], unique=True, name="unique_deal_channel", background=True)
    except Exception: pass

"""

# Substitute lines block
merged_code = orig[:orig.find(part1_marker)] + new_core_logic + orig[orig.find(part3_marker):]

# Update the backwards compat wrapper at the bottom
merged_code = merged_code.replace('''async def post_to_telegram():
    """Backward-compatible function called by scheduler.py after each run."""
    await broadcast_top_deals(limit=3)''', '''async def post_to_telegram():
    """Backward-compatible function called by scheduler.py after each run."""
    await broadcast_smart()''')

# Update /push inside bot to use broadcast_smart
merged_code = re.sub(r'await update\.message\.reply_text\(f"📤 Broadcasting top \{n\} deals to channel…"\)\s*await broadcast_top_deals\(limit=n\)', 'await update.message.reply_text(f"📤 Triggering Smart Broadcast…")\n            await broadcast_smart()', merged_code)

# Add --setup-db to __main__ block
if '--setup-db' not in merged_code:
    merged_code = merged_code.replace('parser.add_argument("--bot"', 'parser.add_argument("--setup-db", action="store_true", help="Create DB indexes")\n    parser.add_argument("--bot"')
    merged_code = merged_code.replace('if args.broadcast:', 'if args.setup_db:\n        ensure_post_log_index()\n        print("✅ DB indexes created for telegram_post_log")\n    elif args.broadcast:')

with open(TELEGRAM_POSTER_FILE, 'w', encoding='utf-8') as f:
    f.write(merged_code)
print(f"Updated {TELEGRAM_POSTER_FILE}")

# 2. Update scheduler.py
with open(SCHEDULER_FILE, 'r', encoding='utf-8') as f:
    sched = f.read()

scheduler_append = '''
    schedule.every().day.at("01:30").do(lambda: asyncio.run(
        __import__('social.telegram_poster', fromlist=['broadcast_deal_of_day']).broadcast_deal_of_day()
    ))
'''
if 'broadcast_deal_of_day' not in sched:
    sched = sched.replace('schedule.every().day.at("04:00").do(email_job)  # 09:30 IST', 
                          'schedule.every().day.at("04:00").do(email_job)  # 09:30 IST' + scheduler_append)

with open(SCHEDULER_FILE, 'w', encoding='utf-8') as f:
    f.write(sched)
print(f"Updated {SCHEDULER_FILE}")
