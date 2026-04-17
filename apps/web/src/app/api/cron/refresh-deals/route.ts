import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/cron/refresh-deals
 *
 * Called by Vercel Cron 2x/day after the GitHub Actions pipeline completes.
 * Deactivates stale deals, clears Redis cache, and revalidates ISR pages
 * so fresh data is served immediately after the scraper pipeline runs.
 *
 * Security: Always requires a valid Bearer CRON_SECRET header.
 * CRON_SECRET must be set in environment variables — returns 500 if missing.
 */

export async function GET(req: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;

  // Always require CRON_SECRET to be configured
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

    await connectDB();

    // Deactivate deals older than 72 h that the pipeline didn't refresh
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const staleResult = await Deal.updateMany(
      { scraped_at: { $lt: cutoff }, is_active: true },
      { $set: { is_active: false } }
    );

    // Clear all known Redis cache keys including the homepage "new today" section
    // and the deal list cache. The deals:feed:* keys are not scannable without
    // redis.keys() so we clear the known static variants.
    const keysToDelete = [
      CACHE_KEYS.TRENDING_DEALS,
      CACHE_KEYS.CATEGORIES,
      CACHE_KEYS.DEAL_LIST(''),
      'deals:new_today',              // BUG-10: was missing; caches homepage new deals section
      'deals:feed:all',               // NEW-05: feed page cache variants
      'deals:feed:electronics',
      'deals:feed:fashion',
      'deals:feed:beauty',
      'deals:feed:home',
    ];
    await Promise.allSettled(keysToDelete.map((k) => redis.del(k)));

    // NEW-05: Revalidate Vercel ISR cache — Redis del alone does not bust ISR pages
    revalidatePath('/');
    revalidatePath('/deals');
    revalidatePath('/deals/feed');

    const stats = {
      stale_deactivated: staleResult.modifiedCount,
      cache_keys_cleared: keysToDelete.length,
      isr_revalidated: ['/', '/deals', '/deals/feed'],
      timestamp: new Date().toISOString(),
    };

    console.log('[cron/refresh-deals]', stats);
    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error('[cron/refresh-deals] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
