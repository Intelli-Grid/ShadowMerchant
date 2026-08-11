import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { sendProConfirmationEmail } from '@/lib/email';
// clerkClient is imported dynamically inside the handler to avoid
// Clerk SDK initialization overhead on cold starts for non-subscription events.

/**
 * Fire-and-forget Telegram admin alert.
 * Uses TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID — already set in Vercel env.
 * Never throws — webhook must always return 200 even if Telegram is down.
 */
async function notifyOwner(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('[Webhook] Telegram owner alert failed:', err);
  }
}

/**
 * Canonical Razorpay webhook handler.
 * Registered at: /api/payments/webhook
 * Handles ALL subscription lifecycle events, syncing both MongoDB AND Clerk metadata.
 *
 * ⚠️ Make sure Razorpay Dashboard → Webhooks points ONLY to this URL:
 *    https://www.shadowmerchant.online/api/payments/webhook
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;

  if (!signature || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  // Verify signature
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (signature !== expectedSig) {
    console.error('[Razorpay Webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);
  const { event: eventType, payload } = event;
  const sub = payload?.subscription?.entity;

  if (!sub) {
    return NextResponse.json({ received: true }); // Ignore non-subscription events
  }

  await connectDB();
  const { clerkClient } = await import('@clerk/nextjs/server');
  const clerk = await clerkClient();

  /**
   * Helper — syncs tier to BOTH MongoDB and Clerk publicMetadata atomically.
   * MongoDB is the source of truth; Clerk controls session-level access checks.
   */
  async function syncTier(
    subscriptionId: string,
    tier: 'pro' | 'free',
    extraFields: Record<string, unknown> = {}
  ) {
    const user = await User.findOneAndUpdate(
      { subscription_id: subscriptionId },
      {
        subscription_tier: tier,
        subscription_status: sub.status,
        updated_at: new Date(),
        ...extraFields,
      },
      { new: true }
    );

    if (user?.clerk_id) {
      // Fetch existing publicMetadata first so we don't wipe other fields.
      // clerk.users.updateUserMetadata does a SHALLOW merge on the top-level
      // object, but nested publicMetadata is replaced — so we spread manually.
      let existingMeta: Record<string, unknown> = {};
      try {
        const clerkUser = await clerk.users.getUser(user.clerk_id);
        existingMeta = (clerkUser.publicMetadata as Record<string, unknown>) ?? {};
      } catch { /* if fetch fails, proceed with empty base — tier will still be set */ }

      await clerk.users.updateUserMetadata(user.clerk_id, {
        publicMetadata: { ...existingMeta, tier },
      });
      console.log(`[Webhook] ${eventType}: User ${user.email} → tier=${tier}, status=${sub.status}`);
    } else {
      console.warn(`[Webhook] ${eventType}: No user found for subscription ${subscriptionId}`);
    }
    return user ?? null;
  }

  switch (eventType) {

    // ── Pro activation / renewal ──────────────────────────────────────────────
    case 'subscription.activated':
    case 'subscription.charged': {
      const activatedUser = await syncTier(sub.id, 'pro', {
        subscription_expires_at: sub.current_end
          ? new Date(sub.current_end * 1000)
          : null,
        subscription_cancel_scheduled: false,
      });
      // Notify Boss in real-time — fire and forget
      const planLabel = sub.plan_id || 'unknown plan';
      const amountPaise = payload?.payment?.entity?.amount ?? 0;
      const amountRupees = (amountPaise / 100).toLocaleString('en-IN');
      const msg = eventType === 'subscription.activated'
        ? `💰 *New Pro Subscriber!*\nEmail: ${activatedUser?.email ?? 'unknown'}\nPlan: ${planLabel}\nSub ID: ${sub.id}`
        : `🔄 *Subscription Renewal*\nEmail: ${activatedUser?.email ?? 'unknown'}\nAmount: ₹${amountRupees}\nSub ID: ${sub.id}`;
      notifyOwner(msg);
      // Send Pro confirmation email on first activation only (not renewals)
      if (eventType === 'subscription.activated' && activatedUser?.email) {
        sendProConfirmationEmail(activatedUser.email, activatedUser.name?.split(' ')[0], planLabel)
          .catch(err => console.error('[Webhook] Pro confirmation email failed:', err));
      }
      break;
    }

    // ── Mid-cycle updates (may flip to inactive) ──────────────────────────────
    case 'subscription.updated': {
      const safeMappedStatus = ['cancelled', 'completed', 'expired', 'halted'];
      const newTier = safeMappedStatus.includes(sub.status) ? 'free' : 'pro';
      await syncTier(sub.id, newTier, {
        subscription_expires_at: sub.current_end
          ? new Date(sub.current_end * 1000)
          : null,
      });
      break;
    }

    // ── Subscription ended (any terminal state) ───────────────────────────────
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.halted':
    case 'subscription.expired': {
      await syncTier(sub.id, 'free', {
        // Keep expires_at so the dashboard can show "Pro until [date]"
        subscription_expires_at: sub.current_end
          ? new Date(sub.current_end * 1000)
          : null,
        subscription_cancel_scheduled: false,
      });
      break;
    }

    // ── Paused (keep pro until payment resolves) ──────────────────────────────
    case 'subscription.paused': {
      // Keep tier as-is; just update status
      await User.findOneAndUpdate(
        { subscription_id: sub.id },
        { subscription_status: 'paused', updated_at: new Date() }
      );
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}
