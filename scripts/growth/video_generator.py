"""
ShadowMerchant — YouTube Short Video Generator
================================================
Generates a 30-second 9:16 vertical video for YouTube Shorts / Instagram Reels.

Pipeline:
  1. Load deal from MongoDB
  2. Generate script (via growth_orchestrator.generate_youtube_script)
  3. Convert script to audio via edge-tts (Microsoft neural TTS, free)
  4. Generate deal card image via Pillow
  5. Compose final video: image + audio + subtitle overlay via moviepy
  6. Save to scripts/growth/output/

Usage:
    python scripts/growth/video_generator.py --deal-id <ObjectId>
    python scripts/growth/video_generator.py --top    # use today's top deal
    python scripts/growth/video_generator.py --test   # use sample data
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
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(dotenv_path=ROOT / ".env")

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("video_gen")

# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────

# 9:16 vertical (YouTube Shorts / Instagram Reels)
VIDEO_W, VIDEO_H = 1080, 1920

# Colours (SM brand palette)
BG_COLOR        = (10, 10, 15)       # #0A0A0F
GOLD_COLOR      = (212, 175, 55)     # #D4AF37
WHITE           = (240, 240, 240)
GRAY            = (107, 114, 128)
GREEN           = (34, 197, 94)
RED             = (239, 68, 68)
DARK_CARD       = (19, 19, 26)       # #13131A

# Font — use system font on Windows
FONT_PATH = Path("C:/Windows/Fonts/seguisb.ttf")   # Segoe UI Semibold
FONT_BOLD = Path("C:/Windows/Fonts/seguibl.ttf")   # Segoe UI Black
FONT_REG  = Path("C:/Windows/Fonts/segoeui.ttf")   # Segoe UI

TTS_VOICE = "en-IN-NeerjaNeural"  # Indian English, female, clear


# ─────────────────────────────────────────────────────────────
# STEP 1 — LOAD DEAL
# ─────────────────────────────────────────────────────────────

def load_deal_by_id(deal_id: str) -> dict:
    from utils.db import get_db
    import bson
    db = get_db()
    try:
        return db.deals.find_one({"_id": bson.ObjectId(deal_id)})
    except Exception as e:
        log.error(f"Failed to load deal {deal_id}: {e}")
        return None


def load_top_deal() -> dict:
    from utils.db import get_db
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    return db.deals.find_one(
        {"is_active": True, "deal_score": {"$gte": 60}, "scraped_at": {"$gte": cutoff}},
        sort=[("deal_score", -1)]
    )


SAMPLE_DEAL = {
    "_id": "test",
    "title": "Prestige 5L Pressure Cooker — Stainless Steel",
    "discounted_price": 2499,
    "original_price": 6500,
    "discount_percent": 62,
    "deal_score": 84,
    "source_platform": "amazon",
    "category": "home",
    "slug": "prestige-5l-pressure-cooker",
    "affiliate_url": "https://www.shadowmerchant.online",
}


# ─────────────────────────────────────────────────────────────
# STEP 2 — GENERATE SCRIPT
# ─────────────────────────────────────────────────────────────

def build_script(deal: dict) -> str:
    """30-second script — expose fake sales or celebrate real ones."""
    title    = deal.get("title", "")[:50]
    cur      = deal.get("discounted_price") or deal.get("current_price", 0)
    orig     = deal.get("original_price", 0)
    disc     = deal.get("discount_percent", 0)
    score    = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "Amazon").title()
    is_real  = score >= 65

    if is_real:
        return (
            f"This {platform} deal is actually real. "
            f"{title}. "
            f"Was {int(orig):,} rupees. Now {int(cur):,}. "
            f"That is {disc} percent off. "
            f"We checked 30 days of price history. "
            f"This is the genuine lowest price. Shadow Score: {score} out of 100. "
            f"Link in bio. More verified deals at ShadowMerchant dot online."
        )
    else:
        return (
            f"This {platform} sale is misleading. "
            f"{title}. "
            f"Shows {int(orig):,} rupees crossed out, now {int(cur):,}. "
            f"Looks like {disc} percent off. "
            f"But 30-day price history says otherwise. "
            f"Shadow Score: only {score} out of 100. "
            f"We expose deals like this every day at ShadowMerchant dot online. "
            f"Link in bio."
        )


# ─────────────────────────────────────────────────────────────
# STEP 3 — TEXT TO SPEECH (edge-tts, free, Microsoft neural)
# ─────────────────────────────────────────────────────────────

async def generate_audio(script: str, output_path: Path) -> bool:
    """Generate MP3 audio from script using edge-tts."""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(script, TTS_VOICE)
        await communicate.save(str(output_path))
        log.info(f"Audio generated: {output_path.name} ({output_path.stat().st_size // 1024}KB)")
        return True
    except ImportError:
        log.error("edge-tts not installed: pip install edge-tts")
        return False
    except Exception as e:
        log.error(f"TTS generation failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# STEP 4 — GENERATE DEAL CARD IMAGE (Pillow)
# ─────────────────────────────────────────────────────────────

def render_deal_card(deal: dict, output_path: Path) -> bool:
    """Create a 1080×1920 deal card image."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        log.error("Pillow not installed: pip install pillow")
        return False

    img  = Image.new("RGB", (VIDEO_W, VIDEO_H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    def load_font(path: Path, size: int):
        try:
            return ImageFont.truetype(str(path), size)
        except Exception:
            return ImageFont.load_default()

    font_huge   = load_font(FONT_BOLD, 90)
    font_large  = load_font(FONT_BOLD, 60)
    font_medium = load_font(FONT_PATH, 42)
    font_small  = load_font(FONT_REG,  36)
    font_tiny   = load_font(FONT_REG,  28)

    title    = deal.get("title", "Deal Alert")
    cur      = deal.get("discounted_price") or deal.get("current_price", 0)
    orig     = deal.get("original_price", 0)
    disc     = deal.get("discount_percent", 0)
    score    = deal.get("deal_score", 0)
    platform = deal.get("source_platform", "Online").upper()
    is_real  = score >= 65

    # ── Background gradient (simulate with rectangles) ─────
    for y in range(VIDEO_H):
        shade = int(10 + (y / VIDEO_H) * 8)
        draw.line([(0, y), (VIDEO_W, y)], fill=(shade, shade, shade + 5))

    # ── Gold accent bar at top ─────────────────────────────
    draw.rectangle([0, 0, VIDEO_W, 12], fill=GOLD_COLOR)

    # ── Platform badge ─────────────────────────────────────
    badge_text = f"  {platform}  "
    draw.rounded_rectangle([60, 80, 60 + len(badge_text) * 22, 140],
                            radius=20, fill=(30, 30, 40), outline=GOLD_COLOR, width=2)
    draw.text((80, 90), badge_text, font=font_small, fill=GOLD_COLOR)

    # ── "REAL DEAL" or "MISLEADING" label ─────────────────
    label       = "REAL DEAL" if is_real else "MISLEADING PRICE"
    label_color = GREEN if is_real else RED
    draw.text((60, 180), label, font=font_large, fill=label_color)

    # ── Title (word-wrapped) ───────────────────────────────
    title_lines = textwrap.wrap(title, width=22)[:4]
    y_pos = 290
    for line in title_lines:
        draw.text((60, y_pos), line, font=font_medium, fill=WHITE)
        y_pos += 55

    # ── Price section ─────────────────────────────────────
    y_price = max(y_pos + 40, 620)

    # Original price (strikethrough)
    orig_text = f"INR {int(orig):,}"
    draw.text((60, y_price), orig_text, font=font_medium, fill=GRAY)
    # Strikethrough line
    bbox = draw.textbbox((60, y_price), orig_text, font=font_medium)
    mid_y = (bbox[1] + bbox[3]) // 2
    draw.line([(60, mid_y), (bbox[2], mid_y)], fill=RED, width=3)

    # Current price
    cur_text = f"INR {int(cur):,}"
    draw.text((60, y_price + 80), cur_text, font=font_huge, fill=GOLD_COLOR)

    # Discount badge
    disc_text = f"-{disc}%"
    disc_x = 60
    disc_y = y_price + 200
    draw.rounded_rectangle([disc_x, disc_y, disc_x + 180, disc_y + 70],
                            radius=35, fill=label_color)
    draw.text((disc_x + 20, disc_y + 12), disc_text, font=font_large, fill=(10, 10, 10))

    # ── Shadow Score dial ─────────────────────────────────
    score_x, score_y = VIDEO_W - 200, y_price + 60
    score_color = GREEN if score >= 75 else (245, 158, 11) if score >= 55 else GRAY
    draw.ellipse([score_x, score_y, score_x + 160, score_y + 160],
                 outline=score_color, width=8)
    score_str = str(score)
    draw.text((score_x + 35, score_y + 35), score_str, font=font_large, fill=score_color)
    draw.text((score_x + 20, score_y + 115), "/ 100", font=font_tiny, fill=GRAY)
    draw.text((score_x + 12, score_y + 145), "SHADOW SCORE", font=font_tiny, fill=GRAY)

    # ── 30-day history callout ─────────────────────────────
    hist_y = score_y + 220
    draw.rounded_rectangle([60, hist_y, VIDEO_W - 60, hist_y + 90],
                            radius=12, fill=DARK_CARD, outline=(40, 40, 55), width=1)
    draw.text((80, hist_y + 12), "30-DAY PRICE HISTORY VERIFIED", font=font_tiny, fill=GOLD_COLOR)
    history_note = "Real discount" if is_real else "Inflated original price detected"
    draw.text((80, hist_y + 48), history_note, font=font_small, fill=WHITE if is_real else RED)

    # ── Branding footer ────────────────────────────────────
    footer_y = VIDEO_H - 200
    draw.rectangle([0, footer_y - 20, VIDEO_W, footer_y - 18], fill=GOLD_COLOR)
    draw.text((60, footer_y), "ShadowMerchant", font=font_large, fill=GOLD_COLOR)
    draw.text((60, footer_y + 80), "shadowmerchant.online", font=font_medium, fill=GRAY)
    draw.text((60, footer_y + 130), "Link in bio", font=font_small, fill=WHITE)

    img.save(str(output_path), "PNG", quality=95)
    log.info(f"Deal card saved: {output_path.name}")
    return True


# ─────────────────────────────────────────────────────────────
# STEP 5 — COMPOSE VIDEO (moviepy)
# ─────────────────────────────────────────────────────────────

def compose_video(image_path: Path, audio_path: Path, output_path: Path) -> bool:
    """Combine image + audio into a 9:16 MP4 video."""
    try:
        from moviepy import AudioFileClip, ImageClip, CompositeVideoClip
    except ImportError:
        log.error("moviepy not installed: pip install moviepy")
        return False

    try:
        audio = AudioFileClip(str(audio_path))
        duration = audio.duration + 1.5   # 1.5s hold after speech ends

        image_clip = (
            ImageClip(str(image_path))
            .with_duration(duration)
            .resized((VIDEO_W, VIDEO_H))
        )

        video = image_clip.with_audio(audio)
        video.write_videofile(
            str(output_path),
            fps=24,
            codec="libx264",
            audio_codec="aac",
            threads=4,
            logger=None,   # suppress verbose moviepy output
        )
        log.info(f"Video rendered: {output_path.name} ({output_path.stat().st_size // 1024}KB)")
        return True
    except Exception as e:
        log.error(f"Video composition failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# STEP 6 — NOTIFY ADMIN (Telegram)
# ─────────────────────────────────────────────────────────────

async def notify_admin_video_ready(deal: dict, video_path: Path, script: str):
    """Send the video file to admin Telegram for review."""
    try:
        import telegram
    except ImportError:
        log.warning("python-telegram-bot not installed — skipping admin notification")
        return

    bot_token     = os.getenv("TELEGRAM_BOT_TOKEN", "")
    admin_chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
    if not bot_token or not admin_chat_id:
        log.warning("Telegram bot token or admin chat ID not set — video saved locally only")
        log.info(f"Video ready at: {video_path}")
        return

    title  = deal.get("title", "")[:50]
    score  = deal.get("deal_score", 0)
    slug   = deal.get("slug") or str(deal.get("_id", ""))
    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "https://www.shadowmerchant.online")

    caption = (
        f"YouTube Short Ready - Review\n\n"
        f"Deal: {title}\n"
        f"Score: {score}/100\n\n"
        f"Script:\n{script}\n\n"
        f"After reviewing:\n"
        f"1. Upload to YouTube as a Short (title: same as script hook)\n"
        f"2. Use this caption:\n"
        f"   {script[:100]}...\n"
        f"   More verified deals: shadowmerchant.online\n"
        f"   #deals #amazondeal #flipkart #savemoney\n\n"
        f"3. Instagram: upload same video as Reel with same caption."
    )

    bot = telegram.Bot(token=bot_token)
    try:
        with open(video_path, "rb") as vf:
            await bot.send_video(
                chat_id=admin_chat_id,
                video=vf,
                caption=caption[:1024],
                supports_streaming=True,
            )
        log.info("Video sent to admin Telegram for review")
    except Exception as e:
        log.error(f"Failed to send video to admin: {e}")
        log.info(f"Video available locally at: {video_path}")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="ShadowMerchant YouTube Short Generator")
    parser.add_argument("--deal-id", help="MongoDB ObjectId of the deal to use")
    parser.add_argument("--top",     action="store_true", help="Use today's top deal")
    parser.add_argument("--test",    action="store_true", help="Use sample deal data")
    parser.add_argument("--no-send", action="store_true", help="Generate video, don't send to admin")
    args = parser.parse_args()

    # ── Load deal ──────────────────────────────────────────
    if args.test:
        deal = SAMPLE_DEAL
        log.info("Using sample deal data")
    elif args.deal_id:
        deal = load_deal_by_id(args.deal_id)
        if not deal:
            log.error(f"Deal not found: {args.deal_id}")
            return
    else:
        deal = load_top_deal()
        if not deal:
            log.error("No suitable deal found. Try --test flag.")
            return

    log.info(f"Generating Short for: {deal.get('title','')[:60]}")

    # ── Generate files ─────────────────────────────────────
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    audio_path = OUTPUT_DIR / f"audio_{ts}.mp3"
    image_path = OUTPUT_DIR / f"card_{ts}.png"
    video_path = OUTPUT_DIR / f"short_{ts}.mp4"

    script = build_script(deal)
    log.info(f"Script ({len(script)} chars): {script[:80]}...")

    ok_audio = await generate_audio(script, audio_path)
    if not ok_audio:
        log.error("Audio generation failed. Check edge-tts installation.")
        return

    ok_image = render_deal_card(deal, image_path)
    if not ok_image:
        log.error("Image generation failed. Check Pillow installation.")
        return

    ok_video = compose_video(image_path, audio_path, video_path)
    if not ok_video:
        log.error("Video composition failed. Check moviepy + ffmpeg installation.")
        return

    # ── Clean up temp files ────────────────────────────────
    audio_path.unlink(missing_ok=True)
    image_path.unlink(missing_ok=True)

    log.info(f"Short generated successfully: {video_path}")
    print(f"\n{'='*50}")
    print(f"VIDEO READY: {video_path}")
    print(f"Script: {script}")
    print(f"{'='*50}\n")

    # ── Send to admin ──────────────────────────────────────
    if not args.no_send:
        await notify_admin_video_ready(deal, video_path, script)


if __name__ == "__main__":
    asyncio.run(main())
