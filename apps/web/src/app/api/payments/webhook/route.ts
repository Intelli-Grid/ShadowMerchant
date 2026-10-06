import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { sendProConfirmationEmail, sendProExpiredEmail } from '@/lib/email';
import { redis } from '@/lib/redis';
// clerkClient is imported dynamically inside the handler to avoid
// Clerk SDK initialization overhead on cold starts for non-subscription events.

/**
 * Fire-and-forget PostHog server-side event via REST.
 * Uses POSTHOG_PROJECT_API_KEY env var — safe to absent (no-op if missing).
 * Never throws — webhook must always return 200.
 */
function phServerCapture(event: string, distinctId: string, props: Record<string, unknown>): void {
  const phKey = process.env.POSTHOG_PROJECT_API_KEY;
  if (!phKey) return;
  const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
  fetch(`${phHost}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: phKey,
      event,
      distinct_id: distinctId,
      properties: props,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {}); // Swallow — analytics must never break webhook delivery
}


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

  // BUG-04: Removed `!` assertion — if RAZORPAY_WEBHOOK_SECRET is missing,
  // crypto.createHmac coerces undefined → 'undefined', making ALL signatures valid.
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured!');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
  }

  // SEC-01: Use timing-safe comparison to prevent signature brute-forcing
  // via response-time side-channel attacks.
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const signaturesMatch = signature.length === expectedSig.length &&
    crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
  if (!signaturesMatch) {
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

  // IDEMPOTENCY: Razorpay retries webhooks up to 8 times over 24 hours on failures.
  // Guard against duplicate processing using a Redis key keyed on the unique
  // event ID. TTL = 25 hours (slightly longer than Razorpay's 24-hour retry window).
  // Falls through silently if Redis is unavailable so no webhook is ever lost.
  const eventId: string | undefined = (event as any).id;
  if (eventId) {
    const idempotencyKey = `webhook:rz:${eventId}`;
    try {
      const alreadyProcessed = await redis.get(idempotencyKey);
      if (alreadyProcessed) {
        console.log(`[Webhook] Duplicate event ignored: ${eventId} (${eventType})`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Mark as processed. TTL = 90000s (25h) to outlast Razorpay's 24h retry window.
      await (redis as any).set(idempotencyKey, '1', { ex: 90000 });
    } catch (redisErr) {
      // Redis unavailable — log and continue. Prefer processing over losing a webhook.
      console.warn('[Webhook] Redis idempotency check failed (continuing):', redisErr);
    }
  }


  /**
   * Helper — syncs tier to BOTH MongoDB and Clerk publicMetadata atomically.
   * MongoDB is the source of truth; Clerk controls session-level access checks.
   * Includes timestamp freshness check to guard against out-of-order event retries.
   */
  async function syncTier(
    subscriptionId: string,
    tier: 'pro' | 'free',
    extraFields: Record<string, unknown> = {}
  ) {
    // PRIMARY lookup: by subscription_id (set by create-subscription route).
    // FALLBACK lookup: by notes.clerk_id embedded at subscription creation time.
    // This fallback exists to handle the race window where Razorpay delivers
    // subscription.activated BEFORE the create-subscription route has written
    // subscription_id to MongoDB. Without this fallback, the user pays but
    // never receives Pro access until Razorpay retries 15 minutes later.
    let existingUser = await User.findOne({ subscription_id: subscriptionId }).lean() as any;
    if (!existingUser && sub?.notes?.clerk_id) {
      existingUser = await User.findOne({ clerk_id: sub.notes.clerk_id }).lean() as any;
      if (existingUser) {
        // Back-fill the subscription_id now that we have it, so future events
        // use the primary path.
        await User.updateOne(
          { clerk_id: sub.notes.clerk_id },
          { subscription_id: subscriptionId }
        );
        console.log(`[Webhook] Race-condition fallback: found user by notes.clerk_id=${sub.notes.clerk_id}, back-filled subscription_id`);
      }
    }

    // SEC-02: Prevent out-of-order event retries from overwriting an active Pro tier.
    // If user is currently active Pro and incoming event is trying to downgrade to free,
    // verify event timestamp if available to prevent stale webhook delivery overwrites.
    if (
      existingUser &&
      existingUser.subscription_tier === 'pro' &&
      existingUser.subscription_status === 'active' &&
      tier === 'free'
    ) {
      const eventTime = event.created_at ? new Date(event.created_at * 1000) : null;
      if (eventTime && existingUser.updated_at && eventTime < new Date(existingUser.updated_at)) {
        console.warn(
          `[Webhook] Ignored out-of-order event ${eventType} for subscription ${subscriptionId} (event time ${eventTime.toISOString()} < updated_at ${new Date(existingUser.updated_at).toISOString()})`
        );
        return existingUser;
      }
    }

    // Use $or query to handle both the normal path (subscription_id is set)
    // and the race-condition fallback path (subscription_id not yet set, but
    // clerk_id is known via Razorpay notes). Without this, the fallback lookup
    // above finds the user but this update still fails to match.
    const updateQuery: Record<string, unknown> = { subscription_id: subscriptionId };
    if (!existingUser?.subscription_id && sub?.notes?.clerk_id) {
      Object.assign(updateQuery, { $or: [
        { subscription_id: subscriptionId },
        { clerk_id: sub.notes.clerk_id },
      ]});
      // Remove top-level subscription_id from query when using $or
      delete updateQuery.subscription_id;
    }

    const user = await User.findOneAndUpdate(
      updateQuery,
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
      } catch (clerkFetchErr) {
        // SECURITY: Do NOT proceed with empty existingMeta — that would overwrite
        // ALL existing metadata (including role=admin) with just { tier }.
        // MongoDB is already updated. Clerk sync is inconsistent but recoverable.
        // Operator can re-sync via POST /api/admin/sync-clerk-tier.
        console.error(
          `[Webhook] Failed to fetch Clerk metadata for ${user.clerk_id} — ` +
          `SKIPPING Clerk update to preserve existing metadata (admin role safe). ` +
          `MongoDB tier=${tier} is set. Clerk may be stale — requires manual reconciliation.`,
          clerkFetchErr
        );
        return user ?? null;
      }

      try {
        await clerk.users.updateUserMetadata(user.clerk_id, {
          publicMetadata: { ...existingMeta, tier },
        });
        console.log(`[Webhook] ${eventType}: User ${user.email} → tier=${tier}, status=${sub.status}`);
      } catch (clerkUpdateErr) {
        // Clerk write failed — MongoDB is already set to tier=${tier} and is authoritative.
        // Do NOT re-throw: subscription_started must fire on MongoDB success, not Clerk success.
        // Clerk state is recoverable via POST /api/admin/sync-clerk-tier?apply=true.
        console.error(
          `[Webhook] Clerk metadata write failed for ${user.clerk_id} — ` +
          `MongoDB tier=${tier} is set. Clerk may be stale — use sync-clerk-tier to repair.`,
          clerkUpdateErr
        );
      }
    } else {
      console.warn(`[Webhook] ${eventType}: No user found for subscription ${subscriptionId}`);
    }
    return user ?? null;
  }

  switch (eventType) {

    // ── Pro activation / renewal ──────────────────────────────────────────────
    case 'subscription.activated':
    case 'subscription.charged': {
      // Determine plan type from Razorpay plan_id
      const monthlyPlanId = process.env.RAZORPAY_MONTHLY_PLAN_ID;
      const annualPlanId  = process.env.RAZORPAY_ANNUAL_PLAN_ID;
      const detectedPlan: 'monthly' | 'annual' | null =
        sub.plan_id === monthlyPlanId ? 'monthly' :
        sub.plan_id === annualPlanId  ? 'annual'  : null;

      if (!detectedPlan) {
        console.warn(
          `[Webhook] Unrecognized plan_id "${sub.plan_id}" for subscription ${sub.id}. Configured IDs: monthly=${monthlyPlanId}, annual=${annualPlanId}`
        );
      }

      const activatedUser = await syncTier(sub.id, 'pro', {
        subscription_expires_at: sub.current_end
          ? new Date(sub.current_end * 1000)
          : null,
        subscription_cancel_scheduled: false,
        // Reset reminder guard so a returning subscriber gets a fresh reminder next cycle.
        annual_reminder_sent_at: null,
        ...(detectedPlan ? { subscription_plan: detectedPlan } : {}),
      });

      // subscription_started fires on MongoDB success alone.
      // Clerk sync failure must NOT suppress this event: MongoDB is the authoritative
      // billing state; Clerk is synchronization/authorization state and is recoverable.
      // Idempotency (Redis guard above) prevents duplicate events on webhook retries.
      if (eventType === 'subscription.activated' && activatedUser) {
        phServerCapture(
          'subscription_started',
          activatedUser.clerk_id ?? sub.id, // clerk_id preferred; sub.id as fallback
          {
            subscription_id: sub.id,
            plan: detectedPlan ?? 'unknown',
            email: activatedUser.email ?? '',
          }
        );
      }

      // Notify Boss in real-time — fire and forget
      const planLabel = detectedPlan ?? sub.plan_id ?? 'unknown plan';
      const amountPaise = payload?.payment?.entity?.amount ?? 0;
      const amountRupees = (amountPaise / 100).toLocaleString('en-IN');
      const msg = eventType === 'subscription.activated'
        ? `💰 *New Pro Subscriber!*\nEmail: ${activatedUser?.email ?? 'unknown'}\nPlan: ${planLabel}\nSub ID: ${sub.id}`
        : `🔄 *Subscription Renewal*\nEmail: ${activatedUser?.email ?? 'unknown'}\nAmount: ₹${amountRupees}\nPlan: ${planLabel}\nSub ID: ${sub.id}`;
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

    // ── Annual subscription natural completion ────────────────────────────────
    // Fired when total_count billing cycles are exhausted (annual plan = 1 cycle).
    // Must downgrade Pro AND notify the customer so they can manually renew.
    case 'subscription.completed': {
      const completedUser = await syncTier(sub.id, 'free', {
        subscription_expires_at: sub.current_end
          ? new Date(sub.current_end * 1000)
          : null,
        subscription_cancel_scheduled: false,
      });
      // Fire-and-forget customer notification — failure MUST NOT break webhook delivery.
      if (completedUser?.email) {
        sendProExpiredEmail(completedUser.email, completedUser.name?.split(' ')[0])
          .catch(err => console.error('[Webhook] sendProExpiredEmail failed (non-fatal):', err));
      }
      // Owner operational alert
      notifyOwner(
        `📋 *Subscription Completed*\nEmail: ${completedUser?.email ?? 'unknown'}\nSub ID: ${sub.id}\nPlan: ${completedUser?.subscription_plan ?? 'unknown'}\nCustomer has been notified to renew manually.`
      );
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
