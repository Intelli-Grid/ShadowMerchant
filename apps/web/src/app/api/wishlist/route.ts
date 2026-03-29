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

  let user = await User.findOne({ clerk_id: userId });
  if (!user) {
    user = await User.create({ clerk_id: userId, subscription_tier: 'free', wishlist: [] });
  }

  if (action === 'add') {
    if (user.subscription_tier !== 'pro' && user.wishlist.length >= 5) {
      return NextResponse.json({ error: 'WISHLIST_LIMIT' }, { status: 403 });
    }
  }

  const update = action === 'remove'
    ? { $pull: { wishlist: deal_id } }
    : { $addToSet: { wishlist: deal_id } };

  const updatedUser = await User.findOneAndUpdate(
    { clerk_id: userId },
    update,
    { new: true }
  );

  return NextResponse.json({ wishlist: updatedUser.wishlist, action });
}
