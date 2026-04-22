import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * GET /api/cron/refresh-deals
 *
 * Called by Vercel Cron 2x/day after the GitHub Actions pipeline completes.
 * Also runs a subscription expiry sweep since Razorpay does not emit a
 * 'subscription.expired' webhook event — users whose subscription_expires_at
 * has passed are downgraded from pro → free here as a safety net.
 *
 * Security: Always requires a valid Bearer CRON_SECRET header.
 * CRON_SECRET must be set in environment variables — returns 500 if missing.
 */

export async function GET(req: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.error('[cron/refresh-deals] CRON_SECRET env var is not set!');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET missing' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { connectDB } = await import('@/lib/db');
    const { redis, CACHE_KEYS } = await import('@/lib/redis');
    const Deal = (await import('@/models/Deal')).default;
    const User = (await import('@/models/User')).default;
    const { clerkClient } = await import('@clerk/nextjs/server');

    await connectDB();

    // ── 1. Deactivate stale deals ────────────────────────────────────────────
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const staleResult = await Deal.updateMany(
      { scraped_at: { $lt: cutoff }, is_active: true },
      { $set: { is_active: false } }
    );

    // ── 2. Clear Redis cache ─────────────────────────────────────────────────
    const keysToDelete = [
      CACHE_KEYS.TRENDING_DEALS,
      CACHE_KEYS.CATEGORIES,
      CACHE_KEYS.DEAL_LIST(''),
      'deals:new_today',
      'deals:hero',           // F-1: hero must be cleared so rotation picks a fresh deal
      'deals:feed:all',
      'deals:feed:electronics',
      'deals:feed:fashion',
      'deals:feed:beauty',
      'deals:feed:home',
      // Rotating category swimlane cache keys (one per category slug)
      'deals:category:electronics',
      'deals:category:fashion',
      'deals:category:beauty',
      'deals:category:home',
      'deals:category:sports',
      'deals:category:gaming',
    ];
    await Promise.allSettled(keysToDelete.map((k) => redis.del(k)));

    // ── 3. Revalidate ISR pages ──────────────────────────────────────────────
    revalidatePath('/');
    revalidatePath('/deals');
    revalidatePath('/deals/feed');

    // ── 4. Subscription expiry sweep ─────────────────────────────────────────
    // Razorpay does NOT emit subscription.expired webhook events, so Pro users
    // whose subscription_expires_at has passed need to be downgraded here.
    // We only target users whose status is NOT one of the known live active states
    // (avoid downgrading paused users who may still reinstate payment).
    const now = new Date();
    const expiredProUsers = await User.find(
      {
        subscription_tier: 'pro',
        subscription_expires_at: { $lt: now },
        subscription_status: { $nin: ['active', 'authenticated', 'created', 'paused'] },
      },
      { clerk_id: 1, email: 1 }
    ).lean();

    let expiredCount = 0;
    if (expiredProUsers.length > 0) {
      const clerk = await clerkClient();
      await Promise.allSettled(
        expiredProUsers.map(async (u: any) => {
          // Downgrade in MongoDB
          await User.updateOne(
            { clerk_id: u.clerk_id },
            { subscription_tier: 'free', updated_at: new Date() }
          );
          // Sync Clerk publicMetadata (safe merge)
          try {
            const clerkUser = await clerk.users.getUser(u.clerk_id);
            const existingMeta = (clerkUser.publicMetadata as Record<string, unknown>) ?? {};
            await clerk.users.updateUserMetadata(u.clerk_id, {
              publicMetadata: { ...existingMeta, tier: 'free' },
            });
          } catch { /* Clerk sync failure is non-fatal — MongoDB is source of truth */ }
          console.log(`[cron] Downgraded expired Pro user: ${u.email}`);
          expiredCount++;
        })
      );
    }

    const stats = {
      stale_deactivated:        staleResult.modifiedCount,
      cache_keys_cleared:       keysToDelete.length,
      isr_revalidated:          ['/', '/deals', '/deals/feed'],
      expired_subs_downgraded:  expiredCount,
      timestamp:                new Date().toISOString(),
    };

    console.log('[cron/refresh-deals]', stats);
    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error('[cron/refresh-deals] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
