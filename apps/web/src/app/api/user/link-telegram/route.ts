import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

/**
 * POST /api/user/link-telegram
 * Links a user's ShadowMerchant account to their Telegram chat_id.
 *
 * Called by the Telegram bot when a user sends /start link_<clerkUserId>.
 * Also called directly from the frontend if we need to confirm the link.
 *
 * Body: { clerkUserId: string, telegramChatId: string }
 */
export async function POST(req: NextRequest) {
  try {
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
