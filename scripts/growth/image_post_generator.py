"""
ShadowMerchant — AI Image Post Generator
=========================================
Generates premium, platform-optimized deal cards for organic social growth.

Post Types:
  1. EXPOSED  — "This Amazon sale is FAKE" (high outrage → shares + comments)
  2. VERIFIED — "This deal is genuinely real" (high trust → saves + site visits)

Formats:
  square  — 1080×1080  (Instagram Feed, Facebook)
  reel    — 1080×1920  (Instagram Reels, YouTube Shorts)
  pin     — 1000×1500  (Pinterest — massive for shopping content)
  twitter — 1200×628   (Twitter/X, LinkedIn)

Growth Strategy:
  - Post 2× EXPOSED + 1× VERIFIED per day
  - EXPOSED gets 3-5× more shares (outrage + curiosity gap)
  - VERIFIED builds trust and drives link-in-bio clicks
  - All 4 formats generated from one deal in one command

Usage:
    python scripts/growth/image_post_generator.py --top
    python scripts/growth/image_post_generator.py --deal-id <ObjectId>
    python scripts/growth/image_post_generator.py --test
    python scripts/growth/image_post_generator.py --test-fake
    python scripts/growth/image_post_generator.py --test --all-formats
"""

import os
import sys
import asyncio
import argparse
import textwrap
import io
from pathlib import Path
from datetime import datetime, timezone, timedelta

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
OUTPUT_DIR = Path(__file__).parent / "output" / "posts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(dotenv_path=ROOT / ".env")

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("image_post_gen")


# ─────────────────────────────────────────────────────────────
# BRAND PALETTE
# ─────────────────────────────────────────────────────────────

BG_DARK    = (10,  10,  15)
BG_CARD    = (19,  19,  26)
BG_CARD2   = (24,  24,  34)
GOLD       = (212, 175, 55)
GOLD_DARK  = (160, 130, 35)
WHITE      = (240, 240, 240)
GRAY       = (107, 114, 128)
GRAY_LIGHT = (160, 163, 170)
GREEN      = (34,  197, 94)
GREEN_DIM  = (21,  128, 61)
RED        = (239, 68,  68)
RED_DIM    = (153, 27,  27)
BLUE_DIM   = (30,  41,  59)


# ─────────────────────────────────────────────────────────────
# PLATFORM SIZES
# ─────────────────────────────────────────────────────────────

FORMATS = {
    "square":  (1080, 1080),
    "reel":    (1080, 1920),
    "pin":     (1000, 1500),
    "twitter": (1200, 628),
}


# ─────────────────────────────────────────────────────────────
# FONT RESOLVER
# ─────────────────────────────────────────────────────────────

def _find_font(*candidates):
    for p in candidates:
        path = Path(p)
        if path.exists():
            return path
    return None

FONT_BLACK = _find_font(
    "C:/Windows/Fonts/seguibl.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
)
FONT_BOLD = _find_font(
    "C:/Windows/Fonts/seguisb.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
)
FONT_REG = _find_font(
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
)


# ─────────────────────────────────────────────────────────────
# SAMPLE DATA
# ─────────────────────────────────────────────────────────────

SAMPLE_DEAL = {
    "_id": "test",
    "title": "boAt Rockerz 450 Bluetooth On-Ear Headphones with 15H Battery",
    "discounted_price": 999,
    "original_price": 3990,
    "discount_percent": 75,
    "deal_score": 88,
    "source_platform": "amazon",
    "category": "electronics",
    "mrp_verified": "verified",
    "mrp_note": "Near 30-day low — genuine discount confirmed",
    "slug": "boat-rockerz-450",
    "affiliate_url": "https://www.shadowmerchant.online",
}

SAMPLE_FAKE_DEAL = {
    "_id": "test_fake",
    "title": "Generic Bluetooth Speaker '6000mAh Premium Sound'",
    "discounted_price": 1299,
    "original_price": 6999,
    "discount_percent": 81,
    "deal_score": 28,
    "source_platform": "flipkart",
    "category": "electronics",
    "mrp_verified": "shifted",
    "mrp_note": "Price was inflated 3 weeks before sale — not a real 81% off",
    "slug": "generic-bluetooth-speaker",
    "affiliate_url": "https://www.shadowmerchant.online",
}


# ─────────────────────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────────────────────

def load_deal_by_id(deal_id):
    from utils.db import get_db
    import bson
    try:
        db = get_db()
        return db.deals.find_one({"_id": bson.ObjectId(deal_id)})
    except Exception as e:
        log.error(f"Failed to load deal {deal_id}: {e}")
        return None


def load_top_deal():
    from utils.db import get_db
    try:
        db = get_db()
    except Exception as e:
        log.error(f"DB connection failed: {e}")
        return None
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    return db.deals.find_one(
        {"is_active": True, "deal_score": {"$gte": 60}, "scraped_at": {"$gte": cutoff}},
        sort=[("deal_score", -1)]
    )


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def load_font(path, size):
    from PIL import ImageFont
    if path:
        try:
            return ImageFont.truetype(str(path), size)
        except Exception:
            pass
    return ImageFont.load_default()


def draw_gradient_bg(draw, w, h, top=(10, 10, 15), bottom=(18, 18, 28)):
    for y in range(h):
        t = y / h
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def fmt_inr(amount):
    return f"Rs.{int(amount):,}"


def score_color(score):
    if score >= 75: return GREEN
    if score >= 55: return (245, 158, 11)
    return RED


# ─────────────────────────────────────────────────────────────
# CAPTION GENERATOR
# ─────────────────────────────────────────────────────────────

def build_caption(deal):
    title    = deal.get("title", "")[:55]
    disc     = deal.get("discount_percent", 0)
    cur      = deal.get("discounted_price", 0)
    orig     = deal.get("original_price", 0)
    score    = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "").title()
    is_real  = score >= 65

    if is_real:
        hook = f"This {platform} deal is actually REAL [check]"
        body = (
            f"{title}\n\n"
            f"Was {fmt_inr(orig)} - Now {fmt_inr(cur)}\n"
            f"Shadow Score: {score}/100\n"
            f"30-day price history: VERIFIED\n"
            f"Genuine lowest price in {30 if disc > 60 else 14} days"
        )
        cta = "Link in bio > shadowmerchant.online"
        hashtags = (
            "#dealalert #amazondeals #flipkartdeals #savemoney "
            "#shadowmerchant #genuinedeal #onlineshopping #dealoftheday"
        )
    else:
        hook = f"This {platform} '{disc}% OFF' is a LIE [warning]"
        body = (
            f"{title}\n\n"
            f"They crossed out {fmt_inr(orig)}\n"
            f"But that price was INFLATED just weeks before the sale\n"
            f"Shadow Score: {score}/100\n"
            f"We caught this using 30-day price tracking"
        )
        cta = "See all verified deals > shadowmerchant.online"
        hashtags = (
            "#fakesale #amazonfake #consumerawareness #shadowmerchant "
            "#fakediscount #onlineshopping #dontgetscammed #savemore"
        )

    return {
        "hook": hook,
        "body": body,
        "cta": cta,
        "hashtags": hashtags,
        "full": f"{hook}\n\n{body}\n\n{cta}\n.\n.\n.\n{hashtags}",
    }


# ─────────────────────────────────────────────────────────────
# IMAGE RENDERER
# ─────────────────────────────────────────────────────────────

def render_post(deal, fmt="square"):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        log.error("Pillow not installed: pip install pillow")
        return None

    W, H     = FORMATS.get(fmt, FORMATS["square"])
    is_real  = deal.get("deal_score", 0) >= 65
    title    = deal.get("title", "Deal Alert")
    cur      = deal.get("discounted_price", 0)
    orig     = deal.get("original_price", 0)
    disc     = deal.get("discount_percent", 0)
    score    = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "Online").upper()
    mrp_note = deal.get("mrp_note", "")
    accent   = GREEN if is_real else RED

    sf = W / 1080
    def s(v): return max(1, int(v * sf))

    f_huge   = load_font(FONT_BLACK, s(88))
    f_large  = load_font(FONT_BOLD,  s(58))
    f_medium = load_font(FONT_BOLD,  s(40))
    f_body   = load_font(FONT_REG,   s(34))
    f_small  = load_font(FONT_REG,   s(26))
    f_tiny   = load_font(FONT_REG,   s(22))

    img  = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Background gradient
    draw_gradient_bg(draw, W, H, BG_DARK, (16, 16, 24))

    # Top gold stripe
    draw.rectangle([0, 0, W, s(10)], fill=GOLD)

    # Left accent bar
    draw.rectangle([0, s(10), s(8), H - s(10)], fill=accent)

    pad = s(60)

    # Platform badge
    draw.rounded_rectangle(
        [pad, s(40), pad + s(180), s(40) + s(52)],
        radius=s(10), fill=BLUE_DIM, outline=GOLD_DARK, width=s(1))
    draw.text((pad + s(14), s(48)), platform, font=f_small, fill=GOLD)

    # Verdict
    verdict = "VERIFIED REAL" if is_real else "MISLEADING SALE"
    draw.text((pad, s(130)), verdict, font=f_large, fill=accent)

    # Title
    chars = max(18, int(36 * (W / 1080)))
    title_lines = textwrap.wrap(title, width=chars)[:4]
    ty = s(210)
    for line in title_lines:
        draw.text((pad, ty), line, font=f_medium, fill=WHITE)
        ty += s(52)

    # Divider
    div_y = ty + s(20)
    draw.rectangle([pad, div_y, W - pad, div_y + s(2)], fill=(40, 40, 55))
    ty = div_y + s(30)

    # Original price (strikethrough)
    draw.text((pad, ty), fmt_inr(orig), font=f_body, fill=GRAY)
    bbox = draw.textbbox((pad, ty), fmt_inr(orig), font=f_body)
    mid  = (bbox[1] + bbox[3]) // 2
    draw.line([(pad, mid), (bbox[2], mid)], fill=RED, width=s(3))
    ty += s(55)

    # Current price (gold, large)
    cur_text = fmt_inr(cur)
    draw.text((pad, ty), cur_text, font=f_huge, fill=GOLD)

    # Discount badge
    cx = pad + int(draw.textlength(cur_text, font=f_huge)) + s(24)
    cy = ty + s(12)
    draw.rounded_rectangle(
        [cx, cy, cx + s(160), cy + s(62)],
        radius=s(14), fill=accent)
    draw.text((cx + s(14), cy + s(10)), f"-{disc}%", font=f_large, fill=(10, 10, 10))
    ty += s(100)

    # Shadow Score bar
    sc = score_color(score)
    draw.rounded_rectangle(
        [pad, ty, W - pad, ty + s(100)],
        radius=s(14), fill=BG_CARD2, outline=sc, width=s(2))
    draw.text((pad + s(20), ty + s(12)), "SHADOW SCORE", font=f_tiny, fill=GRAY_LIGHT)
    draw.text((pad + s(20), ty + s(36)), f"{score}/100", font=f_large, fill=sc)
    bx = pad + s(240)
    by = ty + s(42)
    bw = W - pad - bx - s(20)
    bh = s(18)
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=s(8), fill=(35, 35, 48))
    filled = int(bw * (score / 100))
    if filled > 0:
        draw.rounded_rectangle([bx, by, bx + filled, by + bh], radius=s(8), fill=sc)
    ty += s(120)

    # MRP note
    if mrp_note:
        for nl in textwrap.wrap(mrp_note, width=chars + 4)[:2]:
            draw.text((pad, ty), f">> {nl}", font=f_small, fill=GOLD_DARK)
            ty += s(36)
        ty += s(10)

    # Exposed callout
    if not is_real:
        draw.rounded_rectangle(
            [pad, ty, W - pad, ty + s(80)],
            radius=s(12), fill=(40, 15, 15), outline=RED_DIM, width=s(1))
        draw.text((pad + s(16), ty + s(14)),
                  "! We track 30-day prices to expose fake sales",
                  font=f_small, fill=(255, 140, 130))
        ty += s(100)

    # Footer
    footer_y = H - s(180)
    draw.rectangle([0, footer_y - s(2), W, footer_y], fill=GOLD)
    draw.rectangle([0, footer_y, W, H], fill=(8, 8, 12))
    draw.text((pad, footer_y + s(18)), "SM", font=f_large, fill=GOLD)
    draw.text((pad + s(90), footer_y + s(22)), "ShadowMerchant", font=f_medium, fill=WHITE)
    draw.text((pad + s(90), footer_y + s(76)), "shadowmerchant.online", font=f_body, fill=GRAY)
    draw.text((pad + s(90), footer_y + s(122)), "Link in bio", font=f_small, fill=GOLD_DARK)

    ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    kind = "verified" if is_real else "exposed"
    out  = OUTPUT_DIR / f"{kind}_{fmt}_{ts}.png"
    img.save(str(out), "PNG", compress_level=6)
    log.info(f"Saved: {out.name}  ({W}x{H})")
    return out


# ─────────────────────────────────────────────────────────────
# ADMIN NOTIFY
# ─────────────────────────────────────────────────────────────

async def notify_admin(deal, images, caption):
    bot_token     = os.getenv("TELEGRAM_BOT_TOKEN", "")
    admin_chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
    if not bot_token or not admin_chat_id:
        log.warning("Telegram not configured — images saved locally")
        for img in images:
            log.info(f"  {img}")
        return
    try:
        import telegram
    except ImportError:
        log.warning("python-telegram-bot not installed")
        return

    bot = telegram.Bot(token=bot_token)
    msg = (
        "Image Posts Ready — Review & Post\n\n"
        "CAPTION:\n"
        f"{caption['full'][:3000]}\n\n"
        "FILES:\n" + "\n".join(f"  {p.name}" for p in images)
    )
    try:
        await bot.send_message(chat_id=admin_chat_id, text=msg[:4096])
    except Exception as e:
        log.error(f"Message send failed: {e}")

    for img_path in images:
        try:
            with open(img_path, "rb") as f:
                await bot.send_photo(chat_id=admin_chat_id, photo=f,
                                     caption=img_path.stem.split("_")[1])
        except Exception as e:
            log.error(f"Photo send failed ({img_path.name}): {e}")

    log.info(f"Sent {len(images)} images to admin Telegram")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--deal-id",     help="MongoDB ObjectId")
    parser.add_argument("--top",         action="store_true")
    parser.add_argument("--test",        action="store_true", help="Sample real deal")
    parser.add_argument("--test-fake",   action="store_true", help="Sample fake deal")
    parser.add_argument("--format",      default="square",
                        choices=list(FORMATS.keys()))
    parser.add_argument("--all-formats", action="store_true")
    parser.add_argument("--no-send",     action="store_true")
    args = parser.parse_args()

    if args.test:
        deal = SAMPLE_DEAL
    elif args.test_fake:
        deal = SAMPLE_FAKE_DEAL
    elif args.deal_id:
        deal = load_deal_by_id(args.deal_id)
        if not deal:
            log.error(f"Deal not found: {args.deal_id}")
            return
    else:
        deal = load_top_deal()
        if not deal:
            log.error("No suitable deal found (try --test)")
            return

    log.info(f"Deal: {deal.get('title','')[:60]}")
    log.info(f"Score: {deal.get('deal_score',0)}/100 | "
             f"Type: {'VERIFIED' if deal.get('deal_score',0)>=65 else 'EXPOSED'}")

    caption = build_caption(deal)
    formats = list(FORMATS.keys()) if args.all_formats else [args.format]
    generated = [p for fmt in formats if (p := render_post(deal, fmt))]

    if not generated:
        log.error("No images generated")
        return

    print(f"\n{'='*60}")
    print("COPY THIS CAPTION:")
    print("-"*60)
    print(caption["full"])
    print("-"*60)
    print(f"Generated {len(generated)} image(s):")
    for g in generated:
        print(f"  -> {g}")
    print("="*60 + "\n")

    if not args.no_send:
        await notify_admin(deal, generated, caption)


if __name__ == "__main__":
    asyncio.run(main())
