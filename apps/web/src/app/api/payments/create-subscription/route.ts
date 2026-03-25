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

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: plan === 'annual' ? 1 : 12,
      quantity: 1,
      customer_notify: 1,
    } as any);

    // Store the subscription ID on the user record
    await connectDB();
    await User.findOneAndUpdate(
      { clerk_id: userId },
      { subscription_id: subscription.id },
      { upsert: true }
    );

    return NextResponse.json({ subscription_id: subscription.id });
  } catch (err: any) {
    console.error('[Razorpay] Create subscription error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create subscription' }, { status: 500 });
  }
}
