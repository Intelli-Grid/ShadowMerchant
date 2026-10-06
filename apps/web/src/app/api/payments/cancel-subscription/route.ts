import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { razorpay } from '@/lib/razorpay';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const user = await User.findOne({ clerk_id: userId }).lean() as any;

    if (!user?.subscription_id) {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 });
    }

    // Cancel at end of current billing cycle (not immediately).
    // This matches the customer-facing promise: "Your benefits will remain active
    // until the end of your current billing period." (CancelSubscriptionButton.tsx)
    await razorpay.subscriptions.cancel(user.subscription_id, true);

    // Mark user as scheduled for cancellation
    await User.updateOne(
      { clerk_id: userId },
      { $set: { subscription_cancel_scheduled: true } }
    );

    return NextResponse.json({ success: true, message: 'Subscription will cancel at end of billing period.' });
  } catch (e: any) {
    console.error('Cancel subscription error:', e);
    return NextResponse.json({ error: e?.error?.description || 'Failed to cancel subscription.' }, { status: 500 });
  }
}
