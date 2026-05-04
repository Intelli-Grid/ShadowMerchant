import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Alert from '@/models/Alert';
import Deal from '@/models/Deal';

/**
 * Target Price Alert API
 * ======================
 * Available to ALL logged-in users (not Pro-only).
 * This is the core retention mechanism — users set a target price
 * on a specific deal and get notified when it drops to that price.
 *
 * GET  /api/alerts/target-price?deal_id=xxx  → check if user has an alert for this deal
 * POST /api/alerts/target-price              → create a target price alert
 * DELETE /api/alerts/target-price            → remove an alert by id
 */

// GET — check if current user has an active target price alert for a specific deal
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deal_id = req.nextUrl.searchParams.get('deal_id');
  if (!deal_id) return NextResponse.json({ error: 'deal_id required' }, { status: 400 });

  await connectDB();

  const existing = await Alert.findOne({
    user_id: userId,
    type: 'target_price',
    is_active: true,
    'criteria.deal_id': deal_id,
  }).lean();

  return NextResponse.json({
    hasAlert: !!existing,
    alert: existing
      ? {
          _id: String((existing as any)._id),
          target_price: (existing as any).criteria?.target_price,
          created_at: (existing as any).created_at,
        }
      : null,
  });
}

// POST — create a target price alert for a specific deal
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { deal_id, target_price } = body;

  if (!deal_id || !target_price) {
    return NextResponse.json({ error: 'deal_id and target_price are required' }, { status: 400 });
  }

  const parsedTarget = parseFloat(String(target_price));
  if (isNaN(parsedTarget) || parsedTarget <= 0) {
    return NextResponse.json({ error: 'target_price must be a positive number' }, { status: 400 });
  }

  await connectDB();

  // Verify the deal exists and get current price for context
  const deal = await Deal.findById(deal_id, {
    title: 1, discounted_price: 1, source_platform: 1, is_active: 1,
  }).lean() as any;

  if (!deal || !deal.is_active) {
    return NextResponse.json({ error: 'Deal not found or no longer active' }, { status: 404 });
  }

  // Deactivate any existing target_price alert for this deal from this user
  await Alert.updateMany(
    { user_id: userId, type: 'target_price', 'criteria.deal_id': deal_id },
    { $set: { is_active: false } }
  );

  const alert = await Alert.create({
    user_id: userId,
    type: 'target_price',
    criteria: {
      deal_id: String(deal._id),
      product_title: deal.title,
      platform: deal.source_platform,
      target_price: parsedTarget,
      current_price: deal.discounted_price,
    },
    is_active: true,
  });

  return NextResponse.json(
    {
      alert: {
        _id: String(alert._id),
        target_price: parsedTarget,
        current_price: deal.discounted_price,
        product_title: deal.title,
        platform: deal.source_platform,
      },
    },
    { status: 201 }
  );
}

// DELETE — remove a target price alert by its _id
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { alert_id } = await req.json();
  if (!alert_id) return NextResponse.json({ error: 'alert_id required' }, { status: 400 });

  await connectDB();

  await Alert.findOneAndUpdate(
    { _id: alert_id, user_id: userId, type: 'target_price' },
    { $set: { is_active: false } }
  );

  return NextResponse.json({ success: true });
}
