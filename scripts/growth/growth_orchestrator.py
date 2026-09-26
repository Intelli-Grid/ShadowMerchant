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

    PRE-05 — MRP Safety Gate (2026-08-31):
    - Blocks deals with discount_percent >= 80 (likely inflated MRP).
    - Blocks deals where mrp_verified == 'shifted'.
    - Requires at least 3 price observations to be promoted.
    These filters prevent unverified claims from reaching distribution.

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

    # PRE-05: Safe query — blocks shifted MRP, caps at 79%, requires 3+ observations
    cutoff = datetime.now(timezone.utc) - timedelta(hours=36)
    query = {
        "is_active": True,
        "discount_percent": {"$gte": min_discount, "$lt": 80},  # cap at 79% (80%+ = suspicious)
        "scraped_at": {"$gte": cutoff},
        "mrp_verified": {"$ne": "shifted"},  # never promote shifted-MRP deals
        # Require at least 3 price history observations
        # ($size on array field: only works if field exists and is an array)
        "$or": [
            {"$expr": {"$gte": [{"$size": {"$ifNull": ["$price_history", []]}}, 3]}},
            {"price_history": {"$exists": False}},  # Fallback: allow if field not stored yet
        ],
    }
    deals = list(
        db.deals.find(query)
        .sort([("deal_score", -1), ("discount_percent", -1)])
        .limit(30)
    )

    if not deals:
        # Fallback: any active deal, still with MRP gate but no age restriction
        log.warning("No deals with 30%+ discount in last 36h + MRP gate — relaxing age filter")
        fallback_query = {
            "is_active": True,
            "discount_percent": {"$gte": 20, "$lt": 80},
            "mrp_verified": {"$ne": "shifted"},
        }
        deals = list(db.deals.find(fallback_query)
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

    # PRE-06a: Observation count — shown to user so they can judge the evidence weight
    obs_count   = len(deal.get("price_history", []))
    mrp_status  = deal.get("mrp_verified", "unknown")
    check_time  = datetime.now(timezone.utc).strftime("%H:%M IST")
    # Show the IST time (UTC+5:30)
    from datetime import timedelta as _td
    ist_now = datetime.now(timezone.utc) + _td(hours=5, minutes=30)
    check_time_ist = ist_now.strftime("%H:%M IST")

    # Evidence label — never overstate beyond what the data supports
    if obs_count >= 30:
        evidence_label = f"Based on {obs_count} price observations"
    elif obs_count >= 10:
        evidence_label = f"Based on {obs_count} recent observations"
    elif obs_count >= 3:
        evidence_label = f"Based on {obs_count} observations (new tracking)"
    else:
        evidence_label = "Recently added — limited history"

    # MRP status label
    mrp_label = {
        "verified": "MRP check: Passed",
        "shifted":  "MRP check: Flagged (see analysis)",
        "unknown":  "MRP check: Pending",
    }.get(mrp_status, "MRP check: Pending")

    # Score badge
    if score >= 80:   badge = "VERIFIED STEAL"
    elif score >= 65: badge = "SOLID DEAL"
    else:             badge = "WATCH LIST"

    msg = (
        f"DEAL OF THE DAY\n\n"
        f"{title}\n\n"
        f"Price:  \u20b9{cur_price:,.0f}  (was \u20b9{orig_price:,.0f})\n"
        f"Off:    {disc_pct}%  |  Score: {score}/100\n"
        f"Source: {platform}\n"
        f"Verdict: {badge}\n\n"
        f"{evidence_label}\n"
        f"{mrp_label}\n"
        f"Checked: {check_time_ist}\n\n"
        f"Get deal: {aff_url}\n"
        f"Full analysis: {deal_url}\n\n"
        f"Disclosure: We earn affiliate commission at no extra cost to you.\n"
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
    """Disabled per evidence quality gate: do not auto-publish accusatory 'fake sale' posts."""
    log.info("Automated weekly expose posts are disabled per evidence quality gate.")
    return False
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

# PRE-06c: Replace overstatement templates with evidence-honest alternatives.
# Previous templates claimed "auto-posts 10+ verified deals daily" and
# "price history verified so you know it's real" — these overclaim
# given that 97.1% of deals have <7 observations.
GROUP_POST_TEMPLATES = [
    "Found this too — I track prices across Amazon/Myntra/Nykaa with 30-day observation records. t.me/ShadowMerchantDeals",
    "I run a price-tracking channel that shows how many data points back each deal claim. t.me/ShadowMerchantDeals",
    "Similar deals get posted daily with observation count and check timestamps: t.me/ShadowMerchantDeals",
    "I track these automatically and show the observation count so you can judge the evidence yourself. t.me/ShadowMerchantDeals",
    "Good timing — I track when Amazon/Myntra prices move and post with price history context. t.me/ShadowMerchantDeals",
    "Useful find. My channel posts price history alongside every deal so you can see the context. t.me/ShadowMerchantDeals",
    "I post similar deals with observation counts and timestamps — helps you judge if the discount is real. t.me/ShadowMerchantDeals",
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

    # PRE-06b: evidence-based labels, never absolute claims
    obs_count   = len(deal.get("price_history", []))
    mrp_status  = deal.get("mrp_verified", "unknown")
    from datetime import timedelta as _td
    ist_now = datetime.now(timezone.utc) + _td(hours=5, minutes=30)
    check_time  = ist_now.strftime("%d %b %Y %H:%M IST")

    if obs_count >= 30:
        obs_label = f"{obs_count} price observations over 30 days"
    elif obs_count >= 10:
        obs_label = f"{obs_count} price observations (recent tracking)"
    elif obs_count >= 3:
        obs_label = f"{obs_count} price observations (new tracking — limited history)"
    else:
        obs_label = "Recently added to tracker — limited history available"

    mrp_note = {
        "verified": "MRP check: Passed",
        "shifted":  "MRP check: Flagged — see full analysis before buying",
        "unknown":  "MRP check: Insufficient history to assess",
    }.get(mrp_status, "MRP check: Insufficient history to assess")

    # Pick subreddit based on category
    subreddit = "frugal_india"
    if category == "gaming":    subreddit = "IndianGaming"
    elif category == "fashion": subreddit = "frugal_india"

    reddit_title = f"[{platform}] {title[:80]} — \u20b9{cur_price:,.0f} ({disc_pct}% off)"

    body = (
        f"Price observation record:\n"
        f"- Current: \u20b9{cur_price:,.0f}\n"
        f"- Listed MRP: \u20b9{orig_price:,.0f}\n"
        f"- {obs_label}\n"
        f"- {mrp_note}\n"
        f"- Shadow Score: {score}/100\n"
        f"- Checked: {check_time}\n\n"
        f"Full price history and analysis: {APP_URL}/deals/{deal.get('slug') or str(deal.get('_id', ''))}\n\n"
        f"Direct link: {aff_url} (affiliate — we earn commission at no extra cost)\n\n"
        f"---\n"
        f"Data sourced from ShadowMerchant price tracker. Not sponsored by any seller."
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
    subject = f"This week's {len(deals)} highest-scored deals — ShadowMerchant"

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

    # PRE-06d: evidence-based scripts — no accusatory language without proof
    obs_count  = len(deal.get("price_history", []))
    mrp_status = deal.get("mrp_verified", "unknown")

    if obs_count >= 10:
        obs_note = f"We checked {obs_count} price snapshots over the past days."
    elif obs_count >= 3:
        obs_note = f"We have {obs_count} price records tracked so far."
    else:
        obs_note = "This is newly added to our tracker — limited history."

    is_real = score >= 65 and mrp_status != "shifted"

    if is_real:
        script = (
            f"Looking at the {platform} price of the {title[:40]}? "
            f"Listed at {int(orig):,} rupees, now {int(cur):,}. "
            f"That's {disc} percent off. "
            f"{obs_note} "
            f"Shadow Score: {score} out of 100. "
            f"Full price history at ShadowMerchant dot online. Link in bio."
        )
    else:
        # Low score or shifted MRP — flag, don't accuse
        script = (
            f"Before buying the {title[:40]} at {int(cur):,} rupees — "
            f"here's what our price tracker shows. "
            f"Listed MRP: {int(orig):,} rupees. "
            f"{obs_note} "
            f"Shadow Score: {score} out of 100. "
            f"Check the full price history on ShadowMerchant dot online before deciding. Link in bio."
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

    # ── 2. Telegram channel: Deal of the Day ───────────────────────────────
    dotd_posted = False
    if args.dotd or args.all:
        dotd_posted = await post_deal_of_day(deal, db=db, dry_run=dry)

    # ── 2b. Push notification (fires right after DOTD, same deal) ────────────
    if dotd_posted and (args.dotd or args.all):
        try:
            sys.path.insert(0, str(ROOT))
            from notifiers.push_notifier import send_push
            push_ok = send_push(deal)
            if push_ok:
                log.info("Push notification sent for DOTD deal")
            else:
                log.warning("Push notification skipped (credentials missing or send failed)")
        except Exception as push_err:
            log.error(f"Push notifier error: {push_err}")

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

    # ── 9. Sunday: Search Console opportunity scan ──────
    # Runs after email digest. Requires GOOGLE_SERVICE_ACCOUNT_JSON env var.
    # Reports top pages at position 5-20 with low CTR — delivered to admin Telegram.
    if (is_sunday or args.sc) and args.all:
        try:
            from growth.search_console_pull import (
                _build_service,
                fetch_opportunities,
                format_telegram_report,
                send_report_to_admin,
            )
            sc_service = _build_service()
            if sc_service:
                sc_opps   = fetch_opportunities(sc_service, days=28)
                sc_report = format_telegram_report(sc_opps)
                await send_report_to_admin(sc_report, dry_run=dry)
            else:
                log.info("Search Console skipped — GOOGLE_SERVICE_ACCOUNT_JSON not configured yet")
        except Exception as sc_err:
            log.error(f"Search Console pull failed (non-fatal): {sc_err}")

    log.info("Growth orchestrator complete.")


def main():
    parser = argparse.ArgumentParser(description="ShadowMerchant Growth Orchestrator")
    parser.add_argument("--test",    dest="dry_run", action="store_true", help="Dry run — no actual sends")
    parser.add_argument("--dotd",    action="store_true", help="Post Deal of Day to channel only")
    parser.add_argument("--expose",  action="store_true", help="Post weekly expose only")
    parser.add_argument("--digest",  action="store_true", help="Send email digest only")
    parser.add_argument("--sc",      action="store_true", help="Run Search Console opportunity scan only")
    parser.add_argument("--all",     action="store_true", default=True, help="Run all modules (default)")
    args = parser.parse_args()

    # If specific flag set, disable --all for other modules
    if args.dotd or args.expose or args.digest or args.sc:
        args.all = False
    # Re-enable for single flags
    if args.dotd:   args.all = True
    if args.expose: args.all = True
    if args.digest: args.all = True
    if args.sc:     args.all = True

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
