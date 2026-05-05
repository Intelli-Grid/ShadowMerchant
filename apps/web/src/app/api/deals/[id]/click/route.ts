/**
 * POST /api/deals/[id]/click
 *
 * UPGRADE-K: Deal velocity tracker.
 * Called fire-and-forget from DealCard.tsx when a user clicks "Get Deal →".
 * - Increments click_count and click_count_1h
 * - When click_count_1h >= VELOCITY_THRESHOLD and we haven't notified in the
 *   last 2 hours, triggers a "🔥 Trending Now" Telegram alert for the deal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import DealModel from '@/models/Deal';

const VELOCITY_THRESHOLD = 30;          // clicks within ~1h to trigger alert
const NOTIFY_GAP_MS = 2 * 60 * 60 * 1000; // min 2h between repeated alerts

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const deal = await DealModel.findByIdAndUpdate(
      id,
      { $inc: { click_count_1h: 1, click_count: 1 } },
      { new: true, select: 'title deal_score click_count_1h last_velocity_check source_platform discounted_price discount_percent image_url' }
    ).lean() as any;

    if (!deal) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // Check if velocity threshold is crossed and enough time has passed since last alert
    const now = Date.now();
    const lastCheck = deal.last_velocity_check ? new Date(deal.last_velocity_check).getTime() : 0;
    const shouldNotify =
      (deal.click_count_1h ?? 0) >= VELOCITY_THRESHOLD &&
      (now - lastCheck > NOTIFY_GAP_MS);

    if (shouldNotify) {
      // Update last_velocity_check timestamp to prevent repeated notifications
      await DealModel.findByIdAndUpdate(id, { last_velocity_check: new Date() });

      // Fire Telegram alert non-blocking (best-effort)
      triggerVelocityAlert(deal).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Silent fail — never block the user redirect for analytics
    console.error('[ClickTrack] Error:', error);
    return NextResponse.json({ ok: true }); // Always return 200
  }
}

async function triggerVelocityAlert(deal: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID || '@ShadowMerchantDeals';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online';

  if (!botToken) return;

  const message =
    `🔥 *TRENDING NOW*\n\n` +
    `📦 *${deal.title?.slice(0, 70)}*\n\n` +
    `💰 ₹${Number(deal.discounted_price).toLocaleString('en-IN')} — ${Math.round(deal.discount_percent ?? 0)}% OFF\n` +
    `📊 Shadow Score: ${deal.deal_score}/100\n` +
    `👥 Multiple shoppers viewing this right now\n\n` +
    `👉 [View Deal](${appUrl}/deals/${deal._id})`;

  const payload = {
    chat_id: channelId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
  };

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
