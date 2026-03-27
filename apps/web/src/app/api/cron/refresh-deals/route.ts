import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cron/refresh-deals
 * 
 * Called by Vercel Cron 3x/day as a health check & cache invalidator.
 * The actual scraping is handled by GitHub Actions (see .github/workflows/daily_refresh.yml).
 * This route marks old deals as stale and invalidates Redis cache so the UI
 * immediately reflects any new deals written by the pipeline.
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { connectDB } = await import('@/lib/db');
    const { redis } = await import('@/lib/redis');
    const Deal = (await import('@/models/Deal')).default;

    await connectDB();

    // Deactivate deals older than 72 hours that haven't been refreshed
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const staleResult = await Deal.updateMany(
      { scraped_at: { $lt: cutoff }, is_active: true },
      { $set: { is_active: false } }
    );

    // Flush deal-related Redis cache keys so fresh data is served immediately
    const keys = await redis.keys('deals:*');
    if (keys.length > 0) {
      await Promise.all(keys.map((k: string) => redis.del(k)));
    }

    const stats = {
      stale_deactivated: staleResult.modifiedCount,
      cache_keys_cleared: keys.length,
      timestamp: new Date().toISOString(),
    };

    console.log('[cron/refresh-deals]', stats);
    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error('[cron/refresh-deals] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also allow GET for manual browser testing
export async function GET(req: NextRequest) {
  return POST(req);
}
