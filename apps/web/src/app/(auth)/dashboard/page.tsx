import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Deal from '@/models/Deal';
import Link from 'next/link';
import { Heart, Bell, Zap, TrendingUp, Package, ChevronRight, CheckCircle } from 'lucide-react';

async function getDashboardData(clerkId: string) {
  await connectDB();

  const [user, totalDeals, recentDeals] = await Promise.all([
    User.findOne({ clerk_id: clerkId }).lean(),
    Deal.countDocuments({ is_active: true }),
    Deal.find({ is_active: true }).sort({ published_at: -1 }).limit(3).lean(),
  ]);

  return { user, totalDeals, recentDeals };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/sign-in');

  const { user, totalDeals, recentDeals } = await getDashboardData(clerkUser.id);
  const isPro = user?.subscription_tier === 'pro';
  
  const resolvedParams = await searchParams;
  const justUpgraded = resolvedParams?.upgraded === 'true';

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Upgrade success banner */}
      {justUpgraded && (
        <div className="mb-6 bg-[#7C3AED]/20 border border-[#7C3AED]/40 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />
          <p className="text-white font-semibold text-sm">🎉 Welcome to Pro! Your account has been upgraded.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">
            Hey, {clerkUser.firstName || 'there'} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {isPro ? '⚡ Pro Member' : 'Free Plan'} · {totalDeals.toLocaleString()} deals live right now
          </p>
        </div>
        {!isPro && (
          <Link
            href="/pro"
            className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-[#7C3AED]/20"
          >
            <Zap className="w-4 h-4" /> Upgrade to Pro
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Package, label: 'Live Deals', value: totalDeals.toLocaleString(), color: '#FF6B00' },
          { icon: Heart, label: 'Wishlist', value: user?.wishlist?.length || 0, color: '#F43397' },
          { icon: Bell, label: 'Alerts', value: isPro ? 'Active' : 'Pro Only', color: '#7C3AED' },
          { icon: TrendingUp, label: 'Plan', value: isPro ? 'Pro ⚡' : 'Free', color: isPro ? '#7C3AED' : '#6B7280' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#13131A] border border-[#2A2A35] rounded-xl p-4">
            <Icon className="w-5 h-5 mb-3" style={{ color }} />
            <p className="text-gray-500 text-xs">{label}</p>
            <p className="text-white font-black text-xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[
          { href: '/deals', label: 'Browse All Deals', desc: 'Explore the full deal feed', icon: Package },
          { href: '/wishlist', label: 'My Wishlist', desc: 'Saved deals in one place', icon: Heart },
          { href: '/alerts', label: 'Deal Alerts', desc: isPro ? 'Manage your alerts' : 'Pro feature — upgrade to enable', icon: Bell },
          { href: '/pro', label: 'ShadowMerchant Pro', desc: 'Unlock exclusive deals & alerts', icon: Zap },
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-[#13131A] border border-[#2A2A35] hover:border-[#FF6B00]/40 rounded-xl p-4 flex items-center justify-between group transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#FF6B00]/10 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#FF6B00]" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-gray-500 text-xs">{desc}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FF6B00] transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent deals */}
      {recentDeals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Latest Deals</h2>
            <Link href="/deals" className="text-[#FF6B00] text-sm font-medium hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {recentDeals.map((deal: any) => (
              <Link
                key={deal._id.toString()}
                href={`/deals/${deal._id}`}
                className="flex items-center gap-4 bg-[#13131A] border border-[#2A2A35] hover:border-[#FF6B00]/30 rounded-xl p-4 transition-colors"
              >
                <div className="w-12 h-12 bg-[#1E1E2E] rounded-lg flex items-center justify-center text-xs font-black text-[#FF6B00] flex-shrink-0">
                  {deal.source_platform?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium line-clamp-1">{deal.title}</p>
                  <p className="text-gray-500 text-xs">{deal.source_platform} · {deal.discount_percent}% off</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[#FF6B00] font-black">₹{deal.discounted_price?.toLocaleString('en-IN')}</p>
                  <p className="text-gray-600 line-through text-xs">₹{deal.original_price?.toLocaleString('en-IN')}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
