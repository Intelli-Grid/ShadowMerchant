import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

/**
 * GET /api/user/me
 *
 * Returns the current authenticated user's subscription tier and status.
 * Used by RazorpayButton to poll for Pro activation after payment checkout — 
 * the Razorpay webhook (subscription.activated) arrives ~1-3s after checkout
 * completes, so the client polls this endpoint until subscription_tier === 'pro'
 * before redirecting to the dashboard.
 *
 * HIGH-04: Created to support payment verification polling.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const user = await User.findOne(
    { clerk_id: userId },
    {
      subscription_tier:   1,
      subscription_status: 1,
      subscription_id:     1,
    }
  ).lean();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    subscription_tier:   (user as any).subscription_tier   ?? 'free',
    subscription_status: (user as any).subscription_status ?? 'inactive',
  });
}
