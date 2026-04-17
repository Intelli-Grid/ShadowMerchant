import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Alert from '@/models/Alert';
import User from '@/models/User';

// GET — list user's active alerts (Pro only)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Mirror the same Pro check as POST so the client-side isPro gate fires correctly
  const user = await User.findOne({ clerk_id: userId }).lean();
  if (!user || user.subscription_tier !== 'pro') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 });
  }

  const alerts = await Alert.find({ user_id: userId, is_active: true }).lean();

  // MED-03 fix: include telegramLinked so the alerts page renders the correct
  // Connect/Connected banner without a separate API call.
  const telegramLinked = !!(user as any).notification_channels?.telegram;

  return NextResponse.json({ alerts, telegramLinked });
}

// POST — create a new alert (Pro only)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Check Pro subscription
  const user = await User.findOne({ clerk_id: userId }).lean();
  if (!user || user.subscription_tier !== 'pro') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 });
  }

  const { type, criteria } = await req.json();
  if (!type || !criteria) {
    return NextResponse.json({ error: 'type and criteria are required' }, { status: 400 });
  }

  const alert = await Alert.create({ user_id: userId, type, criteria });
  return NextResponse.json({ alert }, { status: 201 });
}

// DELETE — deactivate an alert
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { alert_id } = await req.json();
  await connectDB();
  await Alert.findOneAndUpdate({ _id: alert_id, user_id: userId }, { is_active: false });
  return NextResponse.json({ success: true });
}
