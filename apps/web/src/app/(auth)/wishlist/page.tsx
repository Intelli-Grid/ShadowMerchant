import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

async function getWishlistData(clerkId: string) {
  const { connectDB } = await import('@/lib/db');
  await connectDB();
  const User = (await import('@/models/User')).default;
  const Deal = (await import('@/models/Deal')).default;
  
  const user = await User.findOne({ clerk_id: clerkId }).lean();
  const isUserPro = user?.subscription_tier === 'pro';
  const wishlistedIds = (user?.wishlist || []).map(String);

  if (!wishlistedIds.length) return { deals: [], isUserPro, wishlistedIds };
  
  const rawDeals = await Deal.find({ _id: { $in: user.wishlist }, is_active: true }).lean();
  const deals: Deal[] = JSON.parse(JSON.stringify(rawDeals));
  return { deals, isUserPro, wishlistedIds };
}

export default async function WishlistPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const { deals, isUserPro, wishlistedIds } = await getWishlistData(user.id);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Heart className="w-7 h-7" style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />
            My Wishlist
          </h1>
          <p className="text-gray-500 mt-1">
            {deals.length > 0 ? `${deals.length} saved deals` : 'Save deals to track them here'}
          </p>
        </div>
      </div>

      {deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} isUserPro={isUserPro} wishlistedIds={wishlistedIds} />
          ))}
        </div>
      ) : (
        <div className="w-full py-24 flex flex-col items-center justify-center rounded-2xl border text-center px-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--gold-dim)' }}>
            <Heart className="w-10 h-10" style={{ color: 'var(--gold)' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Your wishlist is empty</h2>
          <p className="max-w-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Browse deals and hit the ♥ Save button on any deal card to keep track of it here.
          </p>
          <Link
            href="/deals"
            className="font-bold px-8 py-3 rounded-lg transition-all inline-block hover:scale-105 active:scale-95"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          >
            Browse Deals →
          </Link>
        </div>
      )}
    </main>
  );
}
