import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

// Temporary debug endpoint — remove after Pro testing is confirmed
// Visit: /api/debug/whoami while logged in
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' });
  }

  await connectDB();

  const user = await User.findOne({ clerk_id: userId }).lean();

  return NextResponse.json({
    clerk_userId:       userId,
    db_match_found:     !!user,
    db_subscription:    (user as any)?.subscription_tier ?? null,
    db_email:           (user as any)?.email ?? null,
    db_clerk_id_field:  (user as any)?.clerk_id ?? null,
  });
}
