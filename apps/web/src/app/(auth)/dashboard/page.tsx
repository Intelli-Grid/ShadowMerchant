import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Deal from '@/models/Deal';
import Link from 'next/link';
import { Heart, Bell, Zap, TrendingUp, Package, ChevronRight, CheckCircle } from 'lucide-react';
import { CancelSubscriptionButton } from '@/components/pro/CancelSubscriptionButton';
import { ReferralWidget } from '@/components/ReferralWidget';

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

  const STATS = [
    { icon: Package,    label: 'Live Deals', value: totalDeals.toLocaleString(), color: 'var(--gold)' },
    { icon: Heart,      label: 'Wishlist',   value: (user as any)?.wishlist?.length || 0, color: '#F472B6' },
    { icon: Bell,       label: 'Alerts',     value: isPro ? 'Active' : 'Pro Only', color: isPro ? 'var(--gold)' : 'var(--text-muted)' },
    { icon: TrendingUp, label: 'Plan',       value: isPro ? 'Pro ✦' : 'Free', color: isPro ? 'var(--gold)' : 'var(--text-muted)' },
  ];

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Upgrade success banner */}
      {justUpgraded && (
        <div
          className="mb-6 rounded-xl px-5 py-4 flex items-center gap-3"
          style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
          <p className="text-white font-semibold text-sm">🎉 Welcome to Pro! Your account has been upgraded.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Hey, {clerkUser.firstName || 'there'} 👋
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
            {isPro ? '✦ Pro Member' : 'Free Plan'} · {totalDeals.toLocaleString()} deals live right now
          </p>
        </div>
        {!isPro && (
          <Link
            href="/pro"
            className="inline-flex items-center gap-2 font-bold px-5 py-2.5 rounded-lg text-sm transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          >
            <Zap className="w-4 h-4" /> Upgrade to Pro
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {STATS.map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
          >
            <Icon className="w-5 h-5 mb-3" style={{ color }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-white font-black text-xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[
          { href: '/deals',    label: 'Browse All Deals',    desc: 'Explore the full deal feed',              icon: Package },
          { href: '/wishlist', label: 'My Wishlist',         desc: 'Saved deals in one place',                icon: Heart },
          { href: '/alerts',   label: 'Deal Alerts',         desc: isPro ? 'Manage your alerts' : 'Pro feature — upgrade to enable', icon: Bell },
          { href: '/pro',      label: 'ShadowMerchant Pro',  desc: 'Unlock exclusive deals & alerts',         icon: Zap },
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="card-hover rounded-xl p-4 flex items-center justify-between group transition-all"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gold-dim)' }}>
                <Icon className="w-4 h-4" style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} />
          </Link>
        ))}
      </div>

      {/* Subscription Management — Pro users */}
      {isPro && (
        <div
          className="mb-8 rounded-xl p-5 flex items-center justify-between"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
        >
          <div>
            <p className="font-bold text-white text-sm">✦ Pro Membership Active</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              You have access to all Pro exclusive deals and alerts.
            </p>
          </div>
          <CancelSubscriptionButton />
        </div>
      )}

      {/* Referral Program */}
      <div className="mb-8">
        <ReferralWidget />
      </div>

      {/* Recent deals */}
      {recentDeals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white section-heading" style={{ fontFamily: 'var(--font-display)' }}>
              Latest Deals
            </h2>
            <Link href="/deals" className="text-sm font-medium transition-colors" style={{ color: 'var(--gold)' }}>
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {recentDeals.map((deal: any) => (
              <Link
                key={deal._id.toString()}
                href={`/deals/${deal._id}`}
                className="card-hover flex items-center gap-4 rounded-xl p-4 transition-all"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: 'var(--bg-raised)', color: 'var(--gold)' }}
                >
                  {deal.source_platform?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium line-clamp-1">{deal.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {deal.source_platform} · {deal.discount_percent}% off
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black price-display" style={{ color: 'var(--gold)' }}>
                    ₹{deal.discounted_price?.toLocaleString('en-IN')}
                  </p>
                  <p className="line-through text-xs" style={{ color: 'var(--text-muted)' }}>
                    ₹{deal.original_price?.toLocaleString('en-IN')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
