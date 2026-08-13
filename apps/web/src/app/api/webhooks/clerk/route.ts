import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Error occurred -- no svix headers' }, { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json({ error: 'Error occurred -- invalid signature' }, { status: 400 });
  }

  // Handle the webhook
  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { email_addresses, first_name, last_name, primary_email_address_id, unsafe_metadata } = evt.data;

    let email = '';
    if (email_addresses && email_addresses.length > 0) {
      const primaryEmailObj = email_addresses.find((e: any) => e.id === primary_email_address_id);
      email = primaryEmailObj ? primaryEmailObj.email_address : email_addresses[0].email_address;
    }

    try {
      await connectDB();
      
      // Extract UTM attribution from Clerk unsafeMetadata (written by sign-up page)
      const signupSource   = (unsafe_metadata?.utm_source   as string | undefined) ?? 'direct';
      const utmMedium      = (unsafe_metadata?.utm_medium   as string | undefined);
      const utmCampaign    = (unsafe_metadata?.utm_campaign as string | undefined);

      await User.findOneAndUpdate(
        { clerk_id: id },
        {
          $set: {
            email: email,
            name: `${first_name || ''} ${last_name || ''}`.trim(),
            updated_at: new Date()
          },
          $setOnInsert: {
            clerk_id: id,
            subscription_tier: 'free',
            created_at: new Date(),
            wishlist: [],
            signup_source: signupSource,  // attribution — utm_source or 'direct'
          }
        },
        { upsert: true, new: true }
      );

      console.log(`User ${id} synchronized to MongoDB`);

      // Apply referral code if new user signed up via a referral link
      if (eventType === 'user.created') {
        const refCode = unsafe_metadata?.referral_code as string | undefined;
        if (refCode) {
          try {
            const Referral = (await import('@/models/Referral')).default;
            const ref = await Referral.findOne({ referral_code: refCode.toUpperCase() });
            if (ref && ref.referrer_clerk_id !== id && !ref.referred_users.includes(id)) {
              ref.referred_users.push(id);
              ref.total_referrals = ref.referred_users.length;
              const newProMonths = Math.floor(ref.total_referrals / 5) - ref.pro_months_earned;
              if (newProMonths > 0) ref.pro_months_earned += newProMonths;
              await ref.save();
              console.log(`Referral applied: ${refCode} -> new user ${id}`);
            }
          } catch (refErr) {
            console.error('Referral apply error:', refErr);
          }
        }

        // Send welcome email — fire and forget (never blocks the 200 response)
        if (email) {
          sendWelcomeEmail(email, first_name ?? undefined).catch(err =>
            console.error('[SM Clerk Webhook] Welcome email failed:', err)
          );
        }

        // ── PostHog: user_signed_up event with channel attribution ──────────────────
        // Same REST-API pattern as go/[id]/route.ts — no npm PostHog package needed.
        // This is THE event for Week 1 attribution: PostHog breakdown by
        // signup_source shows which channel drove sign-ups.
        const phKey  = process.env.POSTHOG_PROJECT_API_KEY;
        const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
        if (phKey) {
          fetch(`${phHost}/capture/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: phKey,
              event: 'user_signed_up',
              distinct_id: id,   // Clerk user ID — consistent with client-side identify() calls
              properties: {
                signup_source: signupSource,
                utm_medium:    utmMedium   ?? null,
                utm_campaign:  utmCampaign ?? null,
                email,
              },
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});  // fire-and-forget, never block the 200 response
        }
      }
    } catch (e) {
      console.error('Error synchronizing user to MongoDB:', e);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    try {
      await connectDB();
      await User.findOneAndDelete({ clerk_id: id });
    } catch (e) {
      console.error('Error deleting user from MongoDB:', e);
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

