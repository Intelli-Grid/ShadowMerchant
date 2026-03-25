import os
import logging
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from pathlib import Path
from dotenv import load_dotenv
from datetime import date

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.db import get_db


def get_top_deals(db, limit=10):
    return list(
        db.deals.find({"is_active": True})
        .sort("deal_score", -1)
        .limit(limit)
    )


def build_html_email(deals: list) -> str:
    today = date.today().strftime("%B %d, %Y")
    deal_rows = ""
    for d in deals:
        deal_rows += f"""
        <tr>
            <td style="padding:12px;border-bottom:1px solid #2A2A35;">
                <strong style="color:#F0F0F0;">{d.get('title','')[:80]}</strong><br/>
                <span style="color:#6B7280;text-decoration:line-through;">₹{d.get('original_price',0):,.0f}</span>
                &nbsp;<strong style="color:#FF6B00;font-size:18px;">₹{d.get('discounted_price',0):,.0f}</strong>
                &nbsp;<span style="background:#00C853;color:#000;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">{d.get('discount_percent',0)}% OFF</span>
            </td>
            <td style="padding:12px;border-bottom:1px solid #2A2A35;text-align:right;">
                <a href="{d.get('affiliate_url','')}" 
                   style="background:#FF6B00;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    Get Deal →
                </a>
            </td>
        </tr>"""
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:0;background:#0A0A0F;font-family:Inter,Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;padding:24px;">
            <div style="text-align:center;margin-bottom:32px;">
                <h1 style="color:#FF6B00;font-size:28px;margin:0;">ShadowMerchant</h1>
                <p style="color:#6B7280;margin:8px 0 0;">Today's Top 10 Deals — {today}</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#13131A;border-radius:12px;border:1px solid #2A2A35;">
                {deal_rows}
            </table>
            <p style="text-align:center;color:#6B7280;font-size:11px;margin-top:24px;">
                You're receiving this because you subscribed to ShadowMerchant deal alerts.<br/>
                <a href="https://shadowmerchant.in/unsubscribe" style="color:#FF6B00;">Unsubscribe</a> | 
                <a href="https://shadowmerchant.in" style="color:#FF6B00;">View all deals</a>
            </p>
        </div>
    </body>
    </html>"""


def send_digest():
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        logging.error("BREVO_API_KEY not set.")
        return

    db = get_db()
    if db is None:
        return

    deals = get_top_deals(db)
    if not deals:
        logging.info("No deals to send in digest.")
        return

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = api_key
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        sender={"name": "ShadowMerchant Deals", "email": "deals@shadowmerchant.in"},
        reply_to={"email": "noreply@shadowmerchant.in"},
        to=[{"email": "subscribers@shadowmerchant.in"}],  # Replace with list management
        subject=f"🔥 Today's Top Deals — {date.today().strftime('%B %d')}",
        html_content=build_html_email(deals)
    )

    try:
        api_instance.send_transac_email(send_smtp_email)
        logging.info(f"Daily digest sent with {len(deals)} deals.")
    except ApiException as e:
        logging.error(f"Brevo API error: {e}")


if __name__ == "__main__":
    send_digest()
