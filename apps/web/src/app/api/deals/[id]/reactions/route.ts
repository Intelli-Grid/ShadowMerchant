import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import DealReaction from '@/models/DealReaction';

/**
 * GET /api/deals/[id]/reactions
 * Returns aggregate reaction counts + the current user's reaction (if any).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deal_id } = await params;
  const { userId } = await auth();

  await connectDB();

  // Aggregate counts for all reaction types in one query
  const agg = await DealReaction.aggregate([
    { $match: { deal_id } },
    { $group: { _id: '$reaction', count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = { fire: 0, meh: 0, expired: 0 };
  for (const row of agg) counts[row._id] = row.count;

  // Current user's reaction (null if not logged in or not reacted)
  let userReaction: string | null = null;
  if (userId) {
    const existing = await DealReaction.findOne({ deal_id, user_id: userId }).lean();
    userReaction = existing ? (existing as any).reaction : null;
  }

  return NextResponse.json({ counts, userReaction });
}

/**
 * POST /api/deals/[id]/reactions
 * Body: { reaction: 'fire' | 'meh' | 'expired' }
 * Upserts the user's reaction (one per user per deal).
 * If the same reaction is sent again, it is toggled OFF (removed).
 * Always writes updated counts back to Deal.reactions_cache.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: deal_id } = await params;
  const { reaction } = await req.json();

  if (!['fire', 'meh', 'expired'].includes(reaction)) {
    return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
  }

  await connectDB();

  const existing = await DealReaction.findOne({ deal_id, user_id: userId });

  // Toggle: same reaction → remove it
  if (existing && existing.reaction === reaction) {
    await DealReaction.deleteOne({ _id: existing._id });
    await syncCache(deal_id);
    return NextResponse.json({ userReaction: null });
  }

  // Upsert: new or changed reaction
  await DealReaction.findOneAndUpdate(
    { deal_id, user_id: userId },
    { $set: { reaction, created_at: new Date() } },
    { upsert: true }
  );

  await syncCache(deal_id);
  return NextResponse.json({ userReaction: reaction });
}

/**
 * Re-aggregate reaction counts and write them back to the Deal document.
 * Keeps listing pages up-to-date without extra per-card queries.
 */
async function syncCache(deal_id: string) {
  try {
    const DealModel = (await import('@/models/Deal')).default;
    const agg = await DealReaction.aggregate([
      { $match: { deal_id } },
      { $group: { _id: '$reaction', count: { $sum: 1 } } },
    ]);
    const cache: Record<string, number> = { fire: 0, meh: 0, expired: 0 };
    for (const row of agg) cache[row._id] = row.count;

    await DealModel.updateOne(
      { _id: deal_id },
      { $set: { reactions_cache: cache } }
    );
  } catch {
    // Non-critical — don't fail the request if cache sync fails
  }
}
