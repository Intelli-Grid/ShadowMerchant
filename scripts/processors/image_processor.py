"""
Image processor — downloads product images from scraper URLs,
uploads them to Cloudinary (or saves locally as fallback),
and updates the deal's image_url with the CDN-hosted version.

Requires: pip install cloudinary pillow requests
"""
import os
import sys
import logging
import requests
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    "Accept": "image/webp,image/png,image/jpeg,*/*",
}

# ── Optional: Cloudinary upload ──────────────────────────────────────────────
def upload_to_cloudinary(image_bytes: bytes, public_id: str) -> str | None:
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
            api_key=os.getenv("CLOUDINARY_API_KEY"),
            api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        )
        result = cloudinary.uploader.upload(
            BytesIO(image_bytes),
            public_id=f"shadow_merchant/{public_id}",
            overwrite=True,
            resource_type="image",
        )
        return result.get("secure_url")
    except Exception as e:
        logging.warning(f"Cloudinary upload failed: {e}")
        return None


def download_image(url: str) -> bytes | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        resp.raise_for_status()
        if "image" not in resp.headers.get("Content-Type", ""):
            return None
        return resp.content
    except Exception as e:
        logging.warning(f"Image download failed for {url[:60]}: {e}")
        return None


def process_deal_images(limit: int = 50) -> None:
    db = get_db()
    if db is None:
        logging.error("No DB connection.")
        return

    # Find deals with an image URL that we haven't yet mirrored
    deals = list(db.deals.find(
        {
            "is_active": True,
            "image_url": {"$exists": True, "$ne": "", "$not": {"$regex": "cloudinary|res.cloudinary"}},
        },
        {"_id": 1, "image_url": 1, "title": 1}
    ).limit(limit))

    logging.info(f"Processing images for {len(deals)} deals")
    updated = 0

    for deal in deals:
        url = deal.get("image_url", "")
        if not url:
            continue

        image_bytes = download_image(url)
        if not image_bytes:
            continue

        # Try Cloudinary first, fall back to keeping original URL
        cdn_url = upload_to_cloudinary(image_bytes, public_id=str(deal["_id"]))
        if cdn_url:
            db.deals.update_one(
                {"_id": deal["_id"]},
                {"$set": {"image_url": cdn_url, "image_mirrored_at": datetime.now(timezone.utc)}}
            )
            logging.info(f"✅ Uploaded: {deal.get('title','')[:40]}")
            updated += 1
        else:
            logging.info(f"⚠️ Kept original URL: {deal.get('title','')[:40]}")

    logging.info(f"Image processing complete: {updated}/{len(deals)} uploaded to CDN")


if __name__ == "__main__":
    process_deal_images()
