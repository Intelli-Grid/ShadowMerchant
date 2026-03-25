import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

// GET — fetch user's wishlist deal IDs
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ clerk_id: userId }).lean();
  return NextResponse.json({ wishlist: user?.wishlist || [] });
}

// POST — toggle a deal in/out of wishlist
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deal_id, action } = await req.json(); // action: 'add' | 'remove'
  if (!deal_id) return NextResponse.json({ error: 'deal_id required' }, { status: 400 });

  await connectDB();

  const update = action === 'remove'
    ? { $pull: { wishlist: deal_id } }
    : { $addToSet: { wishlist: deal_id } };

  const user = await User.findOneAndUpdate(
    { clerk_id: userId },
    update,
    { upsert: true, new: true }
  );

  return NextResponse.json({ wishlist: user.wishlist, action });
}
