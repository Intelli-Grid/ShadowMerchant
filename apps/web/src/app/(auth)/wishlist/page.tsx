import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart, Zap, Infinity } from 'lucide-react';
import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

async function getWishlistData(clerkId: string) {
  const { connectDB } = await import('@/lib/db');
  await connectDB();
  const User = (await import('@/models/User')).default;
  const Deal = (await import('@/models/Deal')).default;

  const user = await User.findOne({ clerk_id: clerkId }).lean();
  const isPro = user?.subscription_tier === 'pro';
  const totalSaved = user?.wishlist?.length || 0;

  if (!user || !user.wishlist || !user.wishlist.length) return { deals: [], isPro, totalSaved };

  const rawDeals = await Deal.find({ _id: { $in: user.wishlist }, is_active: true }).lean();
  const deals: Deal[] = JSON.parse(JSON.stringify(rawDeals));
  return { deals, isPro, totalSaved };
}

export default async function WishlistPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const { deals, isPro, totalSaved } = await getWishlistData(user.id);
  const isFull = !isPro && totalSaved >= 5;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Heart className="w-7 h-7" style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />
            My Wishlist
          </h1>
          <p className="text-gray-500 mt-1">
            {deals.length > 0 ? `${deals.length} saved deal${deals.length !== 1 ? 's' : ''}` : 'Save deals to track them here'}
          </p>
        </div>
      </div>

      {/* Capacity banner */}
      {isPro ? (
        <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl w-fit text-sm font-semibold" style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}>
          <Infinity className="w-4 h-4" />
          Unlimited wishlist — Pro Member
        </div>
      ) : isFull ? (
        <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-semibold text-red-400">
            Wishlist full <span className="font-black">({totalSaved}/5)</span> — Upgrade to save unlimited deals
          </p>
          <Link href="/pro" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap hover:scale-105 active:scale-95 transition-all" style={{ background: 'var(--gold)', color: '#0A0A0A' }}>
            <Zap className="w-3 h-3" /> Upgrade
          </Link>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="font-bold text-white">{totalSaved}/5</span> wishlist slots used —{' '}
            <Link href="/pro" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: 'var(--gold)' }}>
              Upgrade to Pro
            </Link>{' '}
            for unlimited saves
          </p>
        </div>
      )}

      {deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} />
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
