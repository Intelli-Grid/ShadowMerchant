import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Alert from '@/models/Alert';

export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 });
  }

  let clerkUserId: string;
  try {
    const body = await req.json();
    clerkUserId = body.clerkUserId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!clerkUserId) {
    return NextResponse.json({ error: 'clerkUserId is required' }, { status: 400 });
  }

  await connectDB();

  const user = await User.findOne({ clerk_id: clerkUserId }).lean() as any;
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [userAlerts, firedAlerts] = await Promise.all([
    Alert.countDocuments({ user_id: clerkUserId, is_active: true }),
    Alert.countDocuments({ user_id: clerkUserId, times_triggered: { $gt: 0 } }),
  ]);

  const daysLeft = user.subscription_expires_at
    ? Math.ceil((new Date(user.subscription_expires_at).getTime() - Date.now()) / 86400000)
    : 0;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are writing a retention message for ShadowMerchant, India's AI deal aggregator.
Write warm, honest Hinglish-friendly English that respects Indian users.
Never use manipulative language. Be genuine about the value they've received.
Keep it under 3 sentences. No markdown. No emojis unless they feel natural.
The message will be sent via Telegram or WhatsApp — keep it conversational.`,
        },
        {
          role: 'user',
          content: `Draft a retention message for a Pro user whose subscription expires in ${daysLeft} day(s).
They have set up ${userAlerts} active price alerts. ${firedAlerts} of their alerts have fired.
Their wishlist has ${user.wishlist?.length || 0} saved deals.
Name: ${user.name || 'Member'}.
Make it personal and specific to their actual usage.`,
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    return NextResponse.json({ error: `Groq error: ${groqRes.status}` }, { status: 502 });
  }

  const data = await groqRes.json();
  const message = data.choices?.[0]?.message?.content || '';

  return NextResponse.json({
    message,
    userId: clerkUserId,
    context: { daysLeft, userAlerts, firedAlerts, wishlistSize: user.wishlist?.length || 0 },
  });
}
