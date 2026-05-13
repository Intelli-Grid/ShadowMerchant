import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import { redis } from '@/lib/redis';

/**
 * PATCH /api/admin/pin-deal
 *
 * Manually pin or unpin a deal as "Deal of the Day" or "Featured".
 * Pinning as 'dotd' auto-unpins any previously pinned DoTD.
 *
 * Body: { deal_id: string, pinned_as: 'dotd' | 'featured' | null }
 *   - pass pinned_as: null to unpin
 *
 * Auth: admin role via Clerk publicMetadata.role === 'admin'
 */
export async function PATCH(req: NextRequest) {
  // ── Admin Auth ────────────────────────────────────────────────────────────
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse Body ────────────────────────────────────────────────────────────
  let deal_id: string;
  let pinned_as: 'dotd' | 'featured' | null;

  try {
    const body = await req.json();
    deal_id   = body.deal_id;
    pinned_as = body.pinned_as ?? null;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!deal_id) {
    return NextResponse.json({ error: 'deal_id is required' }, { status: 400 });
  }
  if (!['dotd', 'featured', null].includes(pinned_as)) {
    return NextResponse.json(
      { error: 'pinned_as must be "dotd", "featured", or null' },
      { status: 400 }
    );
  }

  await connectDB();

  // ── If pinning as DoTD: unpin any existing DoTD first (only one can exist) ─
  if (pinned_as === 'dotd') {
    await Deal.updateMany(
      { pinned_as: 'dotd' },
      {
        $set: {
          is_pinned:  false,
          pinned_as:  null,
          pinned_by:  null,
          pinned_at:  null,
        },
      }
    );
  }

  // ── Apply pin / unpin ─────────────────────────────────────────────────────
  const adminClerkId = (sessionClaims as any)?.sub ?? 'admin';
  const updatePayload = pinned_as
    ? {
        is_pinned: true,
        pinned_as,
        pinned_by: adminClerkId,
        pinned_at: new Date(),
      }
    : {
        is_pinned: false,
        pinned_as: null,
        pinned_by: null,
        pinned_at: null,
      };

  const updated = await Deal.findOneAndUpdate(
    { deal_id },
    { $set: updatePayload },
    { new: true, select: 'deal_id title deal_score discount_percent is_pinned pinned_as pinned_at' }
  );

  if (!updated) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // ── Bust hero / trending caches so change is reflected immediately ─────────
  await Promise.allSettled([
    redis.del('deals:hero'),
    redis.del('deals:trending'),
    redis.del('deals:new_today'),
  ]);

  return NextResponse.json({
    success:   true,
    deal_id,
    pinned_as,
    deal:      updated,
    message:   pinned_as
      ? `✅ Deal pinned as ${pinned_as.toUpperCase()}`
      : '✅ Deal unpinned successfully',
  });
}
