import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';

// Generates a unique 6-char alphanumeric code like SM-A3X9KZ
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0,O,1,I)
  let code = 'SM-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET /api/referral — get or create the signed-in user's referral info
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const Referral = (await import('@/models/Referral')).default;

  let ref = await Referral.findOne({ referrer_clerk_id: userId }).lean() as any;

  if (!ref) {
    // Create a code — retry on rare collision
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      try {
        ref = await Referral.create({ referrer_clerk_id: userId, referral_code: code });
        break;
      } catch (e: any) {
        if (e.code === 11000) { code = generateCode(); attempts++; } // duplicate key
        else throw e;
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online';
  return NextResponse.json({
    referral_code: ref.referral_code,
    referral_link: `${appUrl}/?ref=${ref.referral_code}`,
    total_referrals: ref.total_referrals,
    pro_months_earned: ref.pro_months_earned,
    referred_users_count: ref.referred_users?.length ?? 0,
  });
}

// POST /api/referral/apply — called on new user signup with ?ref= param
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { referral_code } = await req.json();
  if (!referral_code) return NextResponse.json({ error: 'No code provided' }, { status: 400 });

  await connectDB();
  const Referral = (await import('@/models/Referral')).default;

  const ref = await Referral.findOne({ referral_code: referral_code.toUpperCase() });
  if (!ref) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });

  // Prevent self-referral
  if (ref.referrer_clerk_id === userId) {
    return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
  }

  // Prevent duplicate referral
  if (ref.referred_users.includes(userId)) {
    return NextResponse.json({ success: true, message: 'Already applied' });
  }

  // Add to referred users
  ref.referred_users.push(userId);
  ref.total_referrals = ref.referred_users.length;

  // Award 1 month Pro for every 5 referrals
  const newProMonths = Math.floor(ref.total_referrals / 5) - ref.pro_months_earned;
  if (newProMonths > 0) {
    ref.pro_months_earned += newProMonths;
    // TODO: trigger Pro subscription extension for referrer via Clerk metadata
  }

  await ref.save();
  return NextResponse.json({ success: true, total_referrals: ref.total_referrals });
}
