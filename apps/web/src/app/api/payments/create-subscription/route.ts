import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { razorpay, PLAN_IDS } from '@/lib/razorpay';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan = 'monthly' } = await req.json();
  const planId = plan === 'annual' ? PLAN_IDS.PRO_ANNUAL : PLAN_IDS.PRO_MONTHLY;

  // Guard: env var check — avoids a cryptic Razorpay 400 if plan IDs are not configured
  if (!planId) {
    console.error('[create-subscription] Missing plan ID env var for plan:', plan);
    return NextResponse.json(
      { error: 'Payment plan not configured. Please contact support.' },
      { status: 503 }
    );
  }

  await connectDB();

  // Guard: prevent duplicate subscriptions.
  // If user is already Pro with an active Razorpay subscription status, return 409
  // so the UI shows an error rather than creating an orphaned subscription in Razorpay.
  const existingUser = await User.findOne(
    { clerk_id: userId },
    { subscription_tier: 1, subscription_status: 1 }
  ).lean();

  const activeStatuses = ['created', 'authenticated', 'active'];
  if (
    (existingUser as any)?.subscription_tier === 'pro' &&
    activeStatuses.includes((existingUser as any)?.subscription_status ?? '')
  ) {
    return NextResponse.json(
      { error: 'You already have an active Pro subscription.' },
      { status: 409 }
    );
  }

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: plan === 'annual' ? 1 : 12,
      quantity: 1,
      customer_notify: 1,
    } as any);

    // Store the subscription ID on the user record so the webhook can find this user
    await User.findOneAndUpdate(
      { clerk_id: userId },
      { subscription_id: subscription.id },
      { upsert: true }
    );

    return NextResponse.json({ subscription_id: subscription.id });
  } catch (err: any) {
    console.error('[Razorpay] Create subscription error:', err);
    const errorMsg = err?.error?.description || err?.description || err?.message || JSON.stringify(err);
    return NextResponse.json({ error: errorMsg || 'Failed to create subscription' }, { status: 500 });
  }
}
