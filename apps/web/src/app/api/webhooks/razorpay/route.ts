import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    await connectDB();
    const client = await clerkClient();

    // Handle subscription events
    if (event.event === 'subscription.charged') {
      const subscriptionId = event.payload.subscription.entity.id;
      const status = event.payload.subscription.entity.status;
      
      const user = await User.findOneAndUpdate(
        { subscription_id: subscriptionId },
        { 
          subscription_status: status,
          subscription_tier: 'pro',
          updated_at: new Date()
        },
        { new: true }
      );

      if (user && user.clerk_id) {
        // Update Clerk User metadata to reflect Pro status
        await client.users.updateUserMetadata(user.clerk_id, {
          publicMetadata: {
            tier: 'pro'
          }
        });
        console.log(`User ${user.email} successfully upgraded to PRO tier via Razorpay webhook.`);
      }
    } else if (event.event === 'subscription.cancelled' || event.event === 'subscription.halted') {
      const subscriptionId = event.payload.subscription.entity.id;
      const status = event.payload.subscription.entity.status;

      const user = await User.findOneAndUpdate(
        { subscription_id: subscriptionId },
        { 
          subscription_status: status,
          subscription_tier: 'free',
          updated_at: new Date()
        },
        { new: true }
      );

      if (user && user.clerk_id) {
        // Downgrade Clerk User metadata
        await client.users.updateUserMetadata(user.clerk_id, {
          publicMetadata: {
            tier: 'free'
          }
        });
        console.log(`User ${user.email} downgraded to FREE tier due to cancelled/halted subscription.`);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Razorpay Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
