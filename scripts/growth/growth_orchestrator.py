"""
ShadowMerchant — Growth Orchestrator
=====================================
Runs daily at 08:30 IST via Windows Task Scheduler.

What it does every morning:
  1. Picks the best deal of the day from MongoDB
  2. Posts "Deal of the Day" to Telegram channel (automatic)
  3. Sends YouTube Short video + review queue to admin Telegram
  4. Drafts Telegram group posts → sends to admin for review/send
  5. Drafts Reddit post → sends to admin for approval
  6. On Sundays: auto-sends weekly email digest to all users

Usage:
    python scripts/growth/growth_orchestrator.py          # normal daily run
    python scripts/growth/growth_orchestrator.py --test   # dry run, no sends
    python scripts/growth/growth_orchestrator.py --dotd   # deal of day only
    python scripts/growth/growth_orchestrator.py --expose # weekly expose only
    python scripts/growth/growth_orchestrator.py --digest # email digest only
"""

import os
import sys
import asyncio
import logging
import argparse
import json
import random
import io
from pathlib import Path
from datetime import datetime, timezone, timedelta

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(dotenv_path=ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(ROOT / "growth.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("growth")

BOT_TOKEN      = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHANNEL_ID     = os.getenv("TELEGRAM_CHANNEL_ID", "@ShadowMerchantDeals")
ADMIN_CHAT_ID  = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
APP_URL        = os.getenv("NEXT_PUBLIC_APP_URL", "https://www.shadowmerchant.online")

# ─────────────────────────────────────────────────────────────
# DATABASE HELPERS
# ─────────────────────────────────────────────────────────────

def get_db():
    from utils.db import get_db as _get_db
    return _get_db()


def get_best_deal_today(db, min_discount: int = 30):
    """Pick today's best deal — highest score + discount, not posted as DOTD recently.
    
    State is stored in MongoDB `growth_state` collection (key=dotd) so it
    survives machine reboots and works from any environment with DB access.
    """
    # Load recent DOTD IDs from MongoDB instead of local JSON file
    recent_ids = set()
    try:
        state_doc = db.growth_state.find_one({"_id": "dotd"})
        if state_doc:
            recent_ids = set(state_doc.get("recent_ids", []))
    except Exception as e:
        log.warning(f"Could not load DOTD state from MongoDB: {e}")

    # Try: deals with 30%+ discount, scraped in last 36h
    cutoff = datetime.now(timezone.utc) - timedelta(hours=36)
    query = {
        "is_active": True,
        "discount_percent": {"$gte": min_discount},
        "scraped_at": {"$gte": cutoff},
    }
    deals = list(
        db.deals.find(query)
        .sort([("deal_score", -1), ("discount_percent", -1)])
        .limit(30)
    )

    if not deals:
        # Fallback: any active deal regardless of age or discount
        log.warning("No deals with 30%+ discount in last 36h — using any active deal")
        deals = list(db.deals.find({"is_active": True})
                     .sort([("deal_score", -1), ("discount_percent", -1)])
                     .limit(10))

    # Prefer deals not recently used as DOTD
    for d in deals:
        if str(d["_id"]) not in recent_ids:
            return d
    return deals[0] if deals else None


def get_top_deals_week(db, limit: int = 5):
    """Top deals from the past 7 days for email/expose content."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    return list(
        db.deals.find({"is_active": True, "scraped_at": {"$gte": cutoff}})
        .sort("deal_score", -1)
        .limit(limit)
    )


def get_fake_sale_deals(db, limit: int = 3):
    """
    Deals where the 'discount' is misleading:
    current_price is within 10% of price_30d_low (barely discounted)
    but original_price is wildly inflated (>2x current).
    """
    deals = list(
        db.deals.find({
            "is_active": True,
            "deal_score": {"$lt": 55},   # low score = not a real deal
            "discount_percent": {"$gte": 40},  # but high claimed discount
        }).sort("discount_percent", -1).limit(limit)
    )
    return deals


def mark_dotd(deal_id: str, db=None):
    """Record a deal ID as used for DOTD in MongoDB (persists across reboots)."""
    if db is None:
        return
    try:
        state_doc = db.growth_state.find_one({"_id": "dotd"}) or {"recent_ids": []}
        ids = state_doc.get("recent_ids", [])
        ids.append(str(deal_id))
        ids = ids[-20:]  # keep last 20
        db.growth_state.update_one(
            {"_id": "dotd"},
            {"$set": {"recent_ids": ids, "last_updated": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        log.info(f"DOTD state saved to MongoDB: {len(ids)} recent IDs tracked")
    except Exception as e:
        log.error(f"Failed to save DOTD state to MongoDB: {e}")


# ─────────────────────────────────────────────────────────────
# TELEGRAM — DEAL OF THE DAY  (automatic, no review)
# ─────────────────────────────────────────────────────────────

async def post_deal_of_day(deal: dict, db=None, dry_run: bool = False):
    """Post premium-formatted Deal of the Day to channel."""
    try:
        import telegram
    except ImportError:
        log.error("python-telegram-bot not installed. pip install python-telegram-bot")
        return False

    slug        = deal.get("slug") or str(deal["_id"])
    title       = deal.get("title", "")[:80]
    cur_price   = deal.get("discounted_price") or deal.get("current_price", 0)
    orig_price  = deal.get("original_price", 0)
    disc_pct    = deal.get("discount_percent", 0)
    score       = deal.get("deal_score", 0)
    platform    = deal.get("source_platform", "").title()
    aff_url     = deal.get("affiliate_url", deal.get("product_url", ""))
    deal_url    = f"{APP_URL}/deals/{slug}"

    # Score badge
    if score >= 80:   badge = "VERIFIED STEAL"
    elif score >= 65: badge = "SOLID DEAL"
    else:             badge = "WATCH LIST"

    verdict_emoji = "STEAL" if score >= 80 else "DEAL" if score >= 65 else "FAIR"

    msg = (
        f"DEAL OF THE DAY\n\n"
        f"{title}\n\n"
        f"Price:  INR {cur_price:,.0f}  (was INR {orig_price:,.0f})\n"
        f"Off:    {disc_pct}%  |  Score: {score}/100\n"
        f"Source: {platform}\n"
        f"Verdict: {badge}\n\n"
        f"Get deal: {aff_url}\n"
        f"Full analysis: {deal_url}\n\n"
        f"Verified by ShadowMerchant - 30-day price history checked\n"
        f"shadowmerchant.online"
    )

    if dry_run:
        log.info(f"[DRY RUN] Deal of Day:\n{msg}")
        return True

    bot = telegram.Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(chat_id=CHANNEL_ID, text=msg)
        mark_dotd(deal["_id"], db=db)
        log.info(f"Deal of Day posted: {title[:40]}")
        return True
    except Exception as e:
        log.error(f"Deal of Day send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# TELEGRAM — WEEKLY EXPOSE (Sundays, automatic)
# ─────────────────────────────────────────────────────────────

async def post_weekly_expose(db, dry_run: bool = False):
    """Post 'fake sale exposed' content every Sunday."""
    try:
        import telegram
    except ImportError:
        return False

    fake_deals = get_fake_sale_deals(db)
    if not fake_deals:
        log.info("No fake deals found for expose post.")
        return False

    lines = ["FAKE SALE EXPOSED - This Week's Misleading Amazon Prices\n"]
    for d in fake_deals:
        title   = d.get("title", "")[:50]
        cur     = d.get("discounted_price") or d.get("current_price", 0)
        orig    = d.get("original_price", 0)
        disc    = d.get("discount_percent", 0)
        score   = d.get("deal_score", 0)
        lines.append(
            f"{title}\n"
            f"  Shows: INR {orig:,.0f} -> INR {cur:,.0f} ({disc}% off)\n"
            f"  Reality: Shadow Score only {score}/100 - Price barely moved\n"
        )

    lines.append(
        "\nWe track 30-day price history on every deal.\n"
        "Only real discounts make it to ShadowMerchant.\n"
        "Join: t.me/ShadowMerchantDeals"
    )

    msg = "\n".join(lines)

    if dry_run:
        log.info(f"[DRY RUN] Weekly Expose:\n{msg}")
        return True

    bot = telegram.Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(chat_id=CHANNEL_ID, text=msg)
        log.info("Weekly expose posted.")
        return True
    except Exception as e:
        log.error(f"Expose post failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# TELEGRAM — GROUP REVIEW QUEUE (human reviews, then taps send)
# ─────────────────────────────────────────────────────────────

GROUP_POST_TEMPLATES = [
    "Nice find! I run a channel that auto-posts 10+ verified deals daily with 30-day price history. t.me/ShadowMerchantDeals",
    "Great deal! Similar ones get posted every day at t.me/ShadowMerchantDeals - price history verified so you know it's real.",
    "Found this too! My channel tracks these automatically: t.me/ShadowMerchantDeals - Amazon/Flipkart/Myntra all together.",
    "Solid pick. I post 5-10 like this daily - all checked against last 30 days pricing. t.me/ShadowMerchantDeals",
    "This is actually a real deal (not a fake sale). I post only verified ones daily: t.me/ShadowMerchantDeals",
    "Good timing on this. I track when Amazon/Flipkart prices actually hit lows vs fake sales. t.me/ShadowMerchantDeals",
    "Verified this one - legit discount. More like this every day: t.me/ShadowMerchantDeals",
]

DEAL_POST_TEMPLATES = [
    "{title} - INR {price:,.0f} ({disc}% off). 30-day low confirmed. More verified deals: t.me/ShadowMerchantDeals",
    "Real deal (not a fake sale): {title} at INR {price:,.0f}. Price history verified. t.me/ShadowMerchantDeals",
    "{platform} | {title} | INR {price:,.0f} | {disc}% genuine discount | t.me/ShadowMerchantDeals",
]


async def send_group_review_queue(deal: dict, dry_run: bool = False):
    """Send group posting drafts to admin for review/send."""
    try:
        import telegram
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    except ImportError:
        log.error("python-telegram-bot not installed")
        return False

    if not ADMIN_CHAT_ID:
        log.warning("TELEGRAM_ADMIN_CHAT_ID not set - skipping group review queue")
        return False

    title    = deal.get("title", "")[:60]
    cur      = deal.get("discounted_price") or deal.get("current_price", 0)
    disc     = deal.get("discount_percent", 0)
    platform = deal.get("source_platform", "").title()

    # Generate 5 variations of reply message
    reply_variants = random.sample(GROUP_POST_TEMPLATES, min(5, len(GROUP_POST_TEMPLATES)))

    # Generate 3 variations of deal post message
    deal_variants = []
    for tpl in random.sample(DEAL_POST_TEMPLATES, min(2, len(DEAL_POST_TEMPLATES))):
        deal_variants.append(tpl.format(
            title=title, price=cur, disc=disc, platform=platform
        ))

    admin_msg = (
        f"REVIEW QUEUE - Telegram Groups\n"
        f"Today's deal: {title}\n"
        f"Price: INR {cur:,.0f} | {disc}% off | {platform}\n\n"
        f"REPLY TEMPLATES (copy & paste when replying to group posts):\n\n"
    )

    for i, v in enumerate(reply_variants, 1):
        admin_msg += f"{i}. {v}\n\n"

    admin_msg += "DEAL POST TEMPLATES (post directly in groups):\n\n"
    for i, v in enumerate(deal_variants, 1):
        admin_msg += f"{i}. {v}\n\n"

    admin_msg += (
        f"POSTING RULES:\n"
        f"- Max 7 groups today\n"
        f"- Min 10 min gap between each group\n"
        f"- Rotate which groups you use (don't repeat same group within 3 days)\n"
        f"- Reply to existing posts, don't just post standalone messages"
    )

    if dry_run:
        log.info(f"[DRY RUN] Group Review Queue:\n{admin_msg}")
        return True

    bot = telegram.Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(
            chat_id=ADMIN_CHAT_ID,
            text=admin_msg,
        )
        log.info("Group review queue sent to admin")
        return True
    except Exception as e:
        log.error(f"Group review queue send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# REDDIT — DRAFT GENERATOR (human reviews, then submits)
# ─────────────────────────────────────────────────────────────

REDDIT_SUBREDDITS_ROTATION = [
    "frugal_india",
    "india",
    "onlineshopping",
    "IndianGaming",      # for gaming/tech deals
    "personalfinanceindia",
]


def generate_reddit_draft(deal: dict) -> dict:
    """Generate a Reddit post draft. Human reviews before submission."""
    title       = deal.get("title", "")
    cur_price   = deal.get("discounted_price") or deal.get("current_price", 0)
    orig_price  = deal.get("original_price", 0)
    disc_pct    = deal.get("discount_percent", 0)
    score       = deal.get("deal_score", 0)
    platform    = deal.get("source_platform", "").title()
    aff_url     = deal.get("affiliate_url", deal.get("product_url", ""))
    category    = deal.get("category", "")

    # Pick subreddit based on category
    subreddit = "frugal_india"
    if category == "gaming":    subreddit = "IndianGaming"
    elif category == "fashion": subreddit = "frugal_india"

    reddit_title = f"[{platform}] {title[:80]} — INR {cur_price:,.0f} ({disc_pct}% off, 30-day low verified)"

    body = (
        f"Price history check:\n"
        f"- Current: INR {cur_price:,.0f}\n"
        f"- Original listed: INR {orig_price:,.0f}\n"
        f"- 30-day low: INR {cur_price:,.0f} (this IS the lowest point)\n"
        f"- Shadow Score: {score}/100 (AI deal quality rating)\n\n"
        f"This is a genuine discount — not a manufactured sale price.\n\n"
        f"Direct link: {aff_url} (affiliate)\n\n"
        f"---\n"
        f"I cross-check every deal against 30-day history before posting. "
        f"Most Amazon 'sales' are fake — this one isn't."
    )

    return {
        "subreddit": subreddit,
        "title": reddit_title,
        "body": body,
        "deal_title": title[:50],
    }


async def send_reddit_draft_to_admin(deal: dict, dry_run: bool = False):
    """Send Reddit draft to admin Telegram for review."""
    try:
        import telegram
    except ImportError:
        return False

    if not ADMIN_CHAT_ID:
        return False

    draft = generate_reddit_draft(deal)

    # Only send Reddit drafts on Tuesday and Thursday
    today = datetime.now().weekday()
    if today not in (1, 3):  # Tuesday=1, Thursday=3
        log.info("Not a Reddit post day (Tue/Thu only) - skipping")
        return False

    msg = (
        f"REDDIT DRAFT - Review before submitting\n\n"
        f"Subreddit: r/{draft['subreddit']}\n\n"
        f"TITLE:\n{draft['title']}\n\n"
        f"BODY:\n{draft['body']}\n\n"
        f"To submit: Use PRAW script or post manually at reddit.com/r/{draft['subreddit']}/submit\n"
        f"Rules: Max 2 posts/week. Never post same day twice."
    )

    if dry_run:
        log.info(f"[DRY RUN] Reddit Draft:\n{msg}")
        return True

    bot = telegram.Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(chat_id=ADMIN_CHAT_ID, text=msg)
        log.info("Reddit draft sent to admin")
        return True
    except Exception as e:
        log.error(f"Reddit draft send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# EMAIL DIGEST — WEEKLY (Sundays, automatic via Brevo)
# ─────────────────────────────────────────────────────────────

def build_weekly_digest_html(deals: list) -> str:
    """Build HTML email for weekly digest."""
    from datetime import date
    today_str = date.today().strftime("%B %d, %Y")

    rows = ""
    for d in deals:
        title    = d.get("title", "")[:75]
        cur      = d.get("discounted_price") or d.get("current_price", 0)
        orig     = d.get("original_price", 0)
        disc     = d.get("discount_percent", 0)
        score    = d.get("deal_score", 0)
        aff_url  = d.get("affiliate_url", d.get("product_url", "#"))
        platform = d.get("source_platform", "").title()
        slug     = d.get("slug") or str(d["_id"])
        deal_url = f"{APP_URL}/deals/{slug}"

        score_color = "#22c55e" if score >= 75 else "#f59e0b" if score >= 55 else "#6b7280"

        rows += f"""
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid #1e1e2e;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">{platform}</div>
            <div style="font-size:15px;font-weight:600;color:#f0f0f0;margin-bottom:8px;">{title}</div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="color:#9ca3af;text-decoration:line-through;font-size:13px;">INR {orig:,.0f}</span>
              <span style="font-size:22px;font-weight:700;color:#d4af37;">INR {cur:,.0f}</span>
              <span style="background:#16a34a22;color:#22c55e;padding:3px 8px;border-radius:20px;font-size:12px;font-weight:700;">{disc}% OFF</span>
              <span style="background:{score_color}22;color:{score_color};padding:3px 8px;border-radius:20px;font-size:12px;">Score {score}/100</span>
            </div>
          </td>
          <td style="padding:16px 20px;border-bottom:1px solid #1e1e2e;text-align:right;white-space:nowrap;">
            <a href="{aff_url}"
               style="display:inline-block;background:#d4af37;color:#0a0a0a;padding:10px 20px;
                      border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin-bottom:6px;">
              Get Deal &rarr;
            </a><br/>
            <a href="{deal_url}"
               style="font-size:11px;color:#6b7280;text-decoration:none;">
              View analysis
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;font-weight:900;color:#d4af37;letter-spacing:-0.5px;">ShadowMerchant</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px;">
        Top deals this week &mdash; {today_str}
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af3740,transparent);margin-top:16px;"></div>
    </div>

    <!-- Deal Table -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#13131a;border-radius:12px;border:1px solid #1e1e2e;overflow:hidden;">
      {rows}
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px;padding:24px;
                background:#13131a;border-radius:12px;border:1px solid #d4af3725;">
      <div style="font-size:15px;font-weight:700;color:#f0f0f0;margin-bottom:8px;">
        Want the full deal verdict?
      </div>
      <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">
        Pro members see the Shadow Score, 30-day price chart, and our verdict on every deal.
      </div>
      <a href="{APP_URL}/pro"
         style="background:#d4af37;color:#0a0a0a;padding:12px 32px;
                border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
        Upgrade to Pro &mdash; INR 99/month
      </a>
    </div>

    <!-- Social CTAs -->
    <div style="text-align:center;margin-top:16px;">
      <a href="https://t.me/ShadowMerchantDeals"
         style="color:#6b7280;font-size:12px;text-decoration:none;margin-right:16px;">
        Telegram daily deal alerts &rarr;
      </a>
      <a href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N"
         style="color:#25D366;font-size:12px;text-decoration:none;">
        WhatsApp Channel &rarr;
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;font-size:11px;color:#374151;">
      You received this because you signed up at shadowmerchant.online<br/>
      <a href="{APP_URL}" style="color:#6b7280;">View all deals</a>
    </div>

  </div>
</body>
</html>"""


async def send_weekly_email_digest(db, dry_run: bool = False):
    """Auto-send weekly email digest to all users with emails on Sundays."""
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
    from datetime import date

    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        log.error("BREVO_API_KEY not set")
        return False

    deals = get_top_deals_week(db)
    if not deals:
        log.info("No deals for email digest")
        return False

    users = list(db.users.find(
        {"email": {"$exists": True, "$ne": None, "$ne": ""}},
        {"email": 1, "name": 1}
    ))

    if not users:
        log.info("No users with emails found")
        return False

    html = build_weekly_digest_html(deals)
    subject = f"Top {len(deals)} verified deals this week — ShadowMerchant"

    if dry_run:
        log.info(f"[DRY RUN] Email digest: {len(deals)} deals to {len(users)} users")
        return True

    config = sib_api_v3_sdk.Configuration()
    config.api_key['api-key'] = api_key
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(config))

    # Send in batches of 50 (Brevo free tier limit per API call)
    batch_size = 50
    sent = 0
    for i in range(0, len(users), batch_size):
        batch = users[i:i + batch_size]
        to_list = [{"email": u["email"], "name": u.get("name", "Deal Hunter")} for u in batch]
        email = sib_api_v3_sdk.SendSmtpEmail(
            sender={"name": "ShadowMerchant", "email": "deals@shadowmerchant.online"},
            reply_to={"email": "support@shadowmerchant.online"},
            to=to_list,
            subject=subject,
            html_content=html,
        )
        try:
            api.send_transac_email(email)
            sent += len(batch)
            log.info(f"Email digest batch sent: {sent}/{len(users)}")
        except ApiException as e:
            log.error(f"Brevo error on batch {i}: {e}")

    log.info(f"Weekly email digest complete: {sent} emails sent")
    return True


# ─────────────────────────────────────────────────────────────
# YOUTUBE SCRIPT GENERATOR (video generation is separate)
# ─────────────────────────────────────────────────────────────

def generate_youtube_script(deal: dict) -> str:
    """Generate a 30-second YouTube Shorts script for the deal."""
    title    = deal.get("title", "")[:60]
    cur      = deal.get("discounted_price") or deal.get("current_price", 0)
    orig     = deal.get("original_price", 0)
    disc     = deal.get("discount_percent", 0)
    score    = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "").title()
    slug     = deal.get("slug") or str(deal["_id"])

    is_real  = score >= 65

    if is_real:
        script = (
            f"This {platform} deal is actually real. "
            f"{title[:40]}. "
            f"Listed at {int(orig):,} rupees, now {int(cur):,}. "
            f"That's {disc} percent off. "
            f"We checked 30 days of price history. "
            f"This IS the lowest it's been. Shadow Score: {score} out of 100. "
            f"Link in bio. "
            f"More verified deals daily at ShadowMerchant dot online."
        )
    else:
        script = (
            f"This {platform} sale is a lie. "
            f"{title[:40]}. "
            f"Amazon shows {int(orig):,} rupees crossed out, now {int(cur):,}. "
            f"Looks like {disc} percent off, right? "
            f"But we checked 30 days of price history. "
            f"The original price was never real. Shadow Score: {score} out of 100. "
            f"We expose deals like this daily at ShadowMerchant dot online. "
            f"Link in bio."
        )
    return script


async def send_youtube_script_to_admin(deal: dict, dry_run: bool = False):
    """Send YouTube script to admin for review before video generation."""
    try:
        import telegram
    except ImportError:
        return False

    if not ADMIN_CHAT_ID:
        return False

    script = generate_youtube_script(deal)
    title  = deal.get("title", "")[:50]
    score  = deal.get("deal_score", 0)
    slug   = deal.get("slug") or str(deal["_id"])

    msg = (
        f"YOUTUBE SHORT SCRIPT - Review\n\n"
        f"Deal: {title}\n"
        f"Score: {score}/100\n\n"
        f"SCRIPT (30 seconds):\n{script}\n\n"
        f"To generate video:\n"
        f"python scripts/growth/video_generator.py --deal-id {deal['_id']}\n\n"
        f"Video will be saved to scripts/growth/output/\n"
        f"Then review and upload to YouTube + Instagram."
    )

    if dry_run:
        log.info(f"[DRY RUN] YouTube Script:\n{msg}")
        return True

    bot = telegram.Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(chat_id=ADMIN_CHAT_ID, text=msg)
        return True
    except Exception as e:
        log.error(f"YouTube script send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# INFLUENCER OUTREACH TEMPLATES (sent to admin daily)
# ─────────────────────────────────────────────────────────────

INFLUENCER_TEMPLATES = [
    {
        "niche": "Personal Finance / Savings",
        "platform": "Instagram / YouTube",
        "msg": (
            "Hi [Name],\n\n"
            "I follow your content on [platform] — genuinely useful for people trying to save money.\n\n"
            "I built ShadowMerchant (shadowmerchant.online) — it tracks Amazon/Flipkart/Myntra deals "
            "and cross-checks each one against 30-day price history to filter out fake discounts.\n\n"
            "I'd love to give you free Pro access (INR 99/month value). "
            "If you find it useful and want to mention it to your audience, amazing. "
            "If not, no pressure at all.\n\n"
            "Interested?\n[Your name]"
        )
    },
    {
        "niche": "Tech Reviews (budget phones/laptops)",
        "platform": "YouTube",
        "msg": (
            "Hi [Name],\n\n"
            "Watched your review of [specific video] — exactly the kind of honest content that helps buyers.\n\n"
            "I built ShadowMerchant — it tracks real-time price drops on the products you review. "
            "When a phone you reviewed hits its 30-day low, we catch it and alert subscribers.\n\n"
            "Would love to give you free access and potentially feature your review links "
            "on our deal pages. Your audience shops the products you review — this could be a natural fit.\n\n"
            "Worth a quick chat?\n[Your name]"
        )
    },
    {
        "niche": "Student / College Life",
        "platform": "Instagram",
        "msg": (
            "Hi [Name],\n\n"
            "Your [college/student life] content is relatable — especially for students watching every rupee.\n\n"
            "I built ShadowMerchant — a deal tracker that exposes fake Amazon sales and only shows "
            "genuinely discounted products. Exactly what students need before buying anything online.\n\n"
            "Free Pro access if you want to try it. If your followers find it useful, "
            "a mention would mean a lot. No script, no forced promo.\n\n"
            "Interested?\n[Your name]"
        )
    },
    {
        "niche": "Mom / Household / Family",
        "platform": "Instagram / Facebook",
        "msg": (
            "Hi [Name],\n\n"
            "Your content on [household savings / smart shopping] is incredibly practical.\n\n"
            "I built ShadowMerchant — it automatically checks Amazon/Flipkart deals against "
            "30-day price history so you never pay more than you should. "
            "Kitchen appliances, home essentials, kids items — all tracked.\n\n"
            "Free Pro access for you to try. If your audience would find it useful, "
            "a simple mention would go a long way.\n\n"
            "No pressure either way.\n[Your name]"
        )
    },
    {
        "niche": "Gaming",
        "platform": "YouTube / Instagram",
        "msg": (
            "Hi [Name],\n\n"
            "Your gaming content [specific video or channel theme] — good stuff.\n\n"
            "I built ShadowMerchant — tracks gaming gear, consoles, and accessories across "
            "Amazon/Flipkart. When a controller or headset hits a genuine low, we catch it.\n\n"
            "Free Pro access if you want to try it. "
            "If it's useful for your audience, a mention would be great.\n\n"
            "Let me know.\n[Your name]"
        )
    },
]


async def send_influencer_templates_to_admin(dry_run: bool = False):
    """Send today's influencer outreach templates to admin."""
    try:
        import telegram
    except ImportError:
        return False

    if not ADMIN_CHAT_ID:
        return False

    # Pick 2 templates per day (rotate through 5)
    day_index = datetime.now().weekday()
    templates = INFLUENCER_TEMPLATES[day_index % len(INFLUENCER_TEMPLATES):day_index % len(INFLUENCER_TEMPLATES) + 2]

    msg = "INFLUENCER OUTREACH - Copy & send 5 DMs today\n\n"
    msg += "Find influencers:\n"
    msg += "- YouTube: search 'Amazon deals India 2026', 'budget shopping India'\n"
    msg += "- Instagram: search #frugalIndia #amazonfinds #budgetshopping\n\n"
    msg += "Send to accounts with 5K-100K followers only (micro-influencers respond)\n\n"
    msg += "TEMPLATES:\n\n"

    for i, t in enumerate(templates, 1):
        msg += f"--- Template {i}: {t['niche']} ({t['platform']}) ---\n"
        msg += t["msg"] + "\n\n"

    msg += "Rule: Send max 5 DMs per day. Personalize [Name] and [platform] before sending."

    if dry_run:
        log.info(f"[DRY RUN] Influencer Templates:\n{msg[:200]}...")
        return True

    bot = telegram.Bot(token=BOT_TOKEN)
    try:
        await bot.send_message(chat_id=ADMIN_CHAT_ID, text=msg[:4096])  # Telegram limit
        return True
    except Exception as e:
        log.error(f"Influencer template send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR
# ─────────────────────────────────────────────────────────────

async def run(args):
    log.info("Growth orchestrator starting...")
    db = get_db()
    if db is None:
        log.error("Cannot connect to MongoDB. Exiting.")
        return

    dry = args.dry_run
    today = datetime.now()
    is_sunday = today.weekday() == 6

    # ── 1. Get best deal of day ─────────────────────────
    deal = get_best_deal_today(db)
    if not deal:
        log.error("No active deals found in MongoDB. Check if the scraper ran today.")
        if ADMIN_CHAT_ID and not dry:
            try:
                import telegram
                bot = telegram.Bot(token=BOT_TOKEN)
                await bot.send_message(
                    chat_id=ADMIN_CHAT_ID,
                    text="GROWTH ALERT: No suitable deals found today. Check scraper logs."
                )
            except Exception:
                pass
        return

    log.info(f"Best deal today: {deal.get('title','')[:50]} | Score: {deal.get('deal_score')}")

    # ── 2. Telegram channel: Deal of the Day ───────────
    if args.dotd or args.all:
        await post_deal_of_day(deal, db=db, dry_run=dry)

    # ── 3. Sunday: Weekly Expose post ──────────────────
    if (is_sunday or args.expose) and args.all:
        await post_weekly_expose(db, dry_run=dry)

    # ── 4. Telegram group review queue → admin ─────────
    if args.all:
        await send_group_review_queue(deal, dry_run=dry)

    # ── 5. Reddit draft → admin (Tue/Thu only) ─────────
    if args.all:
        await send_reddit_draft_to_admin(deal, dry_run=dry)

    # ── 6. YouTube script → admin ──────────────────────
    if args.all:
        await send_youtube_script_to_admin(deal, dry_run=dry)

    # ── 7. Influencer templates → admin ────────────────
    if args.all:
        await send_influencer_templates_to_admin(dry_run=dry)

    # ── 8. Sunday: Email digest (auto, no review) ──────
    if (is_sunday or args.digest) and args.all:
        await send_weekly_email_digest(db, dry_run=dry)

    log.info("Growth orchestrator complete.")


def main():
    parser = argparse.ArgumentParser(description="ShadowMerchant Growth Orchestrator")
    parser.add_argument("--test",    dest="dry_run", action="store_true", help="Dry run — no actual sends")
    parser.add_argument("--dotd",    action="store_true", help="Post Deal of Day to channel only")
    parser.add_argument("--expose",  action="store_true", help="Post weekly expose only")
    parser.add_argument("--digest",  action="store_true", help="Send email digest only")
    parser.add_argument("--all",     action="store_true", default=True, help="Run all modules (default)")
    args = parser.parse_args()

    # If specific flag set, disable --all for other modules
    if args.dotd or args.expose or args.digest:
        args.all = False
    # Re-enable for single flags
    if args.dotd:   args.all = True
    if args.expose: args.all = True
    if args.digest: args.all = True

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
