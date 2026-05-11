import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import { redis, CACHE_KEYS } from '@/lib/redis';

export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Optional dry-run mode — returns counts without mutating
  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  await connectDB();

  const cutoff72h = new Date(Date.now() - 72 * 3600 * 1000);
  const cutoff7d  = new Date(Date.now() - 7 * 86400 * 1000);

  // Count what would be affected
  const [staleCount, deleteCount] = await Promise.all([
    Deal.countDocuments({ scraped_at: { $lt: cutoff72h }, is_active: true }),
    Deal.countDocuments({ scraped_at: { $lt: cutoff7d }, is_active: false }),
  ]);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldDeactivate: staleCount,
      wouldDelete: deleteCount,
      message: 'Dry run — no changes made. Remove ?dryRun=true to execute.',
    });
  }

  // Deactivate deals older than 72h that are still marked active
  const staleResult = await Deal.updateMany(
    { scraped_at: { $lt: cutoff72h }, is_active: true },
    { $set: { is_active: false } }
  );

  // Hard-delete deals older than 7d that are already inactive
  const deleteResult = await Deal.deleteMany({
    scraped_at: { $lt: cutoff7d },
    is_active: false,
  });

  // Bust relevant Redis cache keys
  const cacheKeys = [
    CACHE_KEYS.TRENDING_DEALS,
    CACHE_KEYS.CATEGORIES,
    'deals:new_today',
  ];
  await Promise.allSettled(cacheKeys.map((k) => (redis as any).del(k)));

  return NextResponse.json({
    success: true,
    deactivated: staleResult.modifiedCount,
    deleted: deleteResult.deletedCount,
    cacheBusted: cacheKeys,
    cutoffs: {
      deactivate: cutoff72h.toISOString(),
      delete: cutoff7d.toISOString(),
    },
  });
}
