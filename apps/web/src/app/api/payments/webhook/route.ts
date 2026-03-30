import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;

  // Verify Razorpay webhook signature
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (signature !== expectedSig) {
    console.error('[Razorpay Webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);
  const { event: eventType, payload } = event;

  await connectDB();

  switch (eventType) {
    case 'subscription.updated':
    case 'subscription.activated':
    case 'subscription.charged': {
      const sub = payload.subscription.entity;
      
      // If the update pushed it into an inactive state, downgrade the user
      if (['cancelled', 'completed', 'expired', 'halted'].includes(sub.status)) {
        await User.findOneAndUpdate(
          { subscription_id: sub.id },
          {
            subscription_tier: 'free',
            subscription_status: sub.status,
          }
        );
        console.log(`[Webhook] Subscription ended via update (${sub.status}): ${sub.id}`);
      } 
      // If it is active, unlock Pro features
      else if (sub.status === 'active') {
        await User.findOneAndUpdate(
          { subscription_id: sub.id },
          {
            subscription_tier: 'pro',
            subscription_status: 'active',
            subscription_expires_at: new Date(sub.current_end * 1000),
          }
        );
        console.log(`[Webhook] Pro active/renewed for subscription ${sub.id}`);
      }
      break;
    }

    case 'subscription.completed':
    case 'subscription.halted':
    case 'subscription.cancelled':
    case 'subscription.expired': {
      const sub = payload.subscription.entity;
      await User.findOneAndUpdate(
        { subscription_id: sub.id },
        {
          subscription_tier: 'free',
          subscription_status: sub.status || 'cancelled',
        }
      );
      console.log(`[Webhook] Subscription terminated (${sub.status}): ${sub.id}`);
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}
