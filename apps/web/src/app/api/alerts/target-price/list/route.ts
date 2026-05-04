import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Alert from '@/models/Alert';

/**
 * GET /api/alerts/target-price/list
 * Returns all active target price alerts for the current user.
 * Available to all logged-in users (not Pro-gated).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const alerts = await Alert.find({
    user_id: userId,
    type: 'target_price',
    is_active: true,
  })
    .sort({ created_at: -1 })
    .lean();

  return NextResponse.json({ alerts });
}
