import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

/**
 * POST /api/user/link-telegram
 * Links a user's ShadowMerchant account to their Telegram chat_id.
 *
 * Called exclusively by the Telegram bot when a user sends /start link_<clerkUserId>.
 * Secured via a shared TELEGRAM_BOT_SECRET header to prevent account hijacking.
 *
 * Body: { clerkUserId: string, telegramChatId: string }
 * Header: x-telegram-bot-secret: <TELEGRAM_BOT_SECRET>
 */
export async function POST(req: NextRequest) {
  try {
    // ── Security: validate shared bot secret header ──────────────────────
    const botSecret = req.headers.get('x-telegram-bot-secret');
    const expectedSecret = process.env.TELEGRAM_BOT_SECRET;

    if (!expectedSecret) {
      console.error('[link-telegram] TELEGRAM_BOT_SECRET env var is not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (!botSecret || botSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // ─────────────────────────────────────────────────────────────────────

    const body = await req.json();
    const { clerkUserId, telegramChatId } = body;

    if (!clerkUserId || !telegramChatId) {
      return NextResponse.json(
        { error: 'clerkUserId and telegramChatId are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await User.findOneAndUpdate(
      { clerk_id: clerkUserId },
      { $set: { 'notification_channels.telegram': String(telegramChatId) } },
      { new: true, projection: { clerk_id: 1, email: 1, notification_channels: 1 } }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram linked successfully',
      telegramChatId: result.notification_channels?.telegram,
    });

  } catch (err) {
    console.error('[link-telegram] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/link-telegram
 * Unlinks a user's Telegram account.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    await User.findOneAndUpdate(
      { clerk_id: userId },
      { $unset: { 'notification_channels.telegram': '' } }
    );

    return NextResponse.json({ success: true, message: 'Telegram unlinked' });
  } catch (err) {
    console.error('[unlink-telegram] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
