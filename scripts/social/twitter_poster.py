import os
import logging
import tweepy
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db


def get_top_deal(db):
    return db.deals.find_one(
        {"is_active": True, "is_pro_exclusive": False},
        sort=[("deal_score", -1)]
    )


def format_tweet(deal: dict) -> str:
    title = deal.get("title", "")[:60]
    disc = deal.get("discounted_price", 0)
    pct = deal.get("discount_percent", 0)
    url = deal.get("affiliate_url", "")
    platform = deal.get("source_platform", "").capitalize()

    return (
        f"🔥 {pct}% OFF on {platform}!\n\n"
        f"📦 {title}...\n"
        f"💸 Now only ₹{disc:,.0f}\n\n"
        f"👉 {url}\n\n"
        f"#Deals #India #ShadowMerchant #{platform}Deals"
    )


def post_to_twitter():
    api_key = os.getenv("TWITTER_API_KEY")
    api_secret = os.getenv("TWITTER_API_SECRET")
    access_token = os.getenv("TWITTER_ACCESS_TOKEN")
    access_secret = os.getenv("TWITTER_ACCESS_SECRET")

    if not all([api_key, api_secret, access_token, access_secret]):
        logging.error("Twitter API credentials not fully configured.")
        return

    db = get_db()
    if db is None:
        return

    deal = get_top_deal(db)
    if not deal:
        logging.info("No deal found to tweet.")
        return

    try:
        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_secret
        )
        tweet_text = format_tweet(deal)
        client.create_tweet(text=tweet_text)
        logging.info(f"Tweeted deal: {deal.get('title', '')[:50]}")
    except Exception as e:
        logging.error(f"Failed to tweet: {e}")


if __name__ == "__main__":
    post_to_twitter()
