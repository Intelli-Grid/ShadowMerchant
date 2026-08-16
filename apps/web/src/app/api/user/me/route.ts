import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { ratelimit, safeRateLimit } from '@/lib/redis';

/**
 * GET /api/user/me
 *
 * Returns the current authenticated user's subscription tier and status.
 * Used by RazorpayButton to poll for Pro activation after payment checkout —
 * the Razorpay webhook (subscription.activated) arrives ~1-3s after checkout
 * completes, so the client polls this endpoint until subscription_tier === 'pro'
 * before redirecting to the dashboard.
 *
 * Rate limited: 60 req/min per user — allows the polling loop (1 req/sec × 30s)
 * while capping abuse from tight loops or automated scripts.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 60/min per user — covers the payment polling loop (1 req/s × 30s max)
  const { success } = await safeRateLimit(ratelimit, `me:${userId}`);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
