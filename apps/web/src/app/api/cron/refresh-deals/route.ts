import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cron/refresh-deals
 *
 * Called by Vercel Cron 2x/day after the GitHub Actions pipeline completes.
 * Deactivates stale deals and clears Redis cache so fresh data is served.
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
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

    // Clear known cache keys (targeted delete — no redis.keys() scan needed)
    const keysToDelete = [
      CACHE_KEYS.TRENDING_DEALS,
      CACHE_KEYS.CATEGORIES,
      CACHE_KEYS.DEAL_LIST(''),   // base list key
    ];
    await Promise.allSettled(keysToDelete.map((k) => redis.del(k)));

    const stats = {
      stale_deactivated: staleResult.modifiedCount,
      cache_keys_cleared: keysToDelete.length,
      timestamp: new Date().toISOString(),
    };

    console.log('[cron/refresh-deals]', stats);
    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error('[cron/refresh-deals] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Allow GET for manual browser testing
export async function GET(req: NextRequest) {
  return POST(req);
}
