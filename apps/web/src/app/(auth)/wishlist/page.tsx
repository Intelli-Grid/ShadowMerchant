import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

async function getWishlistDeals(userId: string): Promise<Deal[]> {
  // In a full implementation, fetch user from DB, get wishlist deal_ids, then fetch deals
  // For now we return empty — the UI handles the empty state gracefully
  return [];
}

export default async function WishlistPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const deals = await getWishlistDeals(user.id);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Heart className="w-7 h-7 text-[#FF6B00] fill-[#FF6B00]" />
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
            <DealCard key={deal._id} deal={deal} />
          ))}
        </div>
      ) : (
        <div className="w-full py-24 flex flex-col items-center justify-center bg-[#13131A] rounded-2xl border border-[#2A2A35] text-center px-6">
          <div className="w-20 h-20 bg-[#FF6B00]/10 rounded-full flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-[#FF6B00]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Your wishlist is empty</h2>
          <p className="text-gray-500 max-w-sm mb-8">
            Browse deals and hit the ♥ Save button on any deal card to keep track of it here.
          </p>
          <Link
            href="/deals"
            className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold px-8 py-3 rounded-lg transition-colors inline-block"
          >
            Browse Deals →
          </Link>
        </div>
      )}
    </main>
  );
}
