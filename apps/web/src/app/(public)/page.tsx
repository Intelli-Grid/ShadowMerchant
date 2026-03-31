import { DealCard } from '@/components/deals/DealCard';
import { CategoryBrowser } from '@/components/CategoryBrowser';
import { Badge } from '@/components/ui/badge';
import { Deal } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { connectDB } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';

// Fetch the top 8 trending deals (is_trending=true, mix of free + pro)
async function getTrendingDeals(): Promise<{ deals: Deal[]; isStale: boolean }> {
  const cached = await redis.get<{ deals: Deal[]; isStale: boolean }>(CACHE_KEYS.TRENDING_DEALS);
  if (cached) return cached;
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Primary: trending deals scraped within last 48 hours (live)
    let deals = await DealModel.find({ is_active: true, is_trending: true, scraped_at: { $gte: cutoff48h } })
      .sort({ deal_score: -1 })
      .limit(8)
      .lean();
    let isStale = false;

    // Fallback A: any trending deals regardless of age
    if (!deals || deals.length === 0) {
      deals = await DealModel.find({ is_active: true, is_trending: true })
        .sort({ deal_score: -1 })
        .limit(8)
        .lean();
      isStale = true;
    }

    // Fallback B: highest-scored active deals (scraper hasn't run at all)
    if (!deals || deals.length === 0) {
      deals = await DealModel.find({ is_active: true })
        .sort({ deal_score: -1, rating: -1 })
        .limit(8)
        .lean();
      isStale = true;
    }

    const result = { deals: JSON.parse(JSON.stringify(deals)), isStale };
    await redis.set(CACHE_KEYS.TRENDING_DEALS, result, { ex: CACHE_TTL.TRENDING });
    return result;
  } catch (e) {
    console.error('getTrendingDeals error:', e);
    return { deals: [], isStale: false };
  }
}

async function getNewDealsToday(): Promise<{ deals: Deal[]; isStale: boolean }> {
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Primary: deals scraped in last 24 hours (truly new today)
    let deals = await DealModel.find({ is_active: true, scraped_at: { $gte: cutoff24h } })
      .sort({ deal_score: -1 })
      .limit(8)
      .lean();
    let isStale = false;

    // Fallback A: deals scraped within 48 hours
    if (!deals || deals.length === 0) {
      deals = await DealModel.find({ is_active: true, scraped_at: { $gte: cutoff48h } })
        .sort({ deal_score: -1 })
        .limit(8)
        .lean();
      isStale = deals.length > 0;
    }

    // Fallback B: newest active deals regardless of age (scraper stale)
    if (!deals || deals.length === 0) {
      deals = await DealModel.find({ is_active: true })
        .sort({ created_at: -1, deal_score: -1 })
        .limit(8)
        .lean();
      isStale = true;
    }

    return { deals: JSON.parse(JSON.stringify(deals)), isStale };
  } catch (e) {
    console.error('getNewDealsToday error:', e);
    return { deals: [], isStale: false };
  }
}

export default async function Home() {

  // Parallelise all data fetching
  const [trendingResult, newResult] = await Promise.all([
    getTrendingDeals(),
    getNewDealsToday()
  ]);

  const trendingDeals = trendingResult.deals;
  const newDeals = newResult.deals;
  const trendingIsStale = trendingResult.isStale;
  const newIsStale = newResult.isStale;

  // Total savings across all trending deals
  const totalSavings = trendingDeals.reduce(
    (acc, d) => acc + (d.original_price - d.discounted_price), 0
  );
  const formattedSavings = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(totalSavings);

  return (
    <main className="flex-1 w-full flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12 text-center flex flex-col items-center">
        {/* Compact Hero badge */}
        <Badge
          className="mb-3 font-semibold px-3 py-1 text-xs shadow-sm"
          style={{
            background: 'var(--gold-dim)',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
          }}
          variant="secondary"
        >
          ⚡ {trendingDeals.length > 0
            ? `${trendingDeals.length} Top Deals Found Live`
            : "India's Best Deals, All in One Place"}
        </Badge>

        {/* Main headline - Compacted */}
        <h1 className="text-2xl md:text-4xl font-black mb-3 tracking-tight text-white leading-tight max-w-3xl">
          Stop hunting across 10 apps. <br className="hidden md:block" />
          <span className="text-gold-shimmer">The best deals find you.</span>
        </h1>

        <p className="text-sm md:text-base mb-6 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          ShadowMerchant automatically discovers &amp; scores the best-discounted products from Amazon, Flipkart, Myntra, and more.
          {totalSavings > 0 && (
            <span className="block mt-1">
              Combined savings available today:{' '}
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formattedSavings}</span>
            </span>
          )}
        </p>

        {/* Platform trust badges - Extremely subtle */}
        <div className="flex items-center justify-center gap-3 flex-wrap opacity-50 mb-2">
          {['🛒 Amazon', '🔵 Flipkart', '👗 Myntra', '🛍️ Meesho', '💄 Nykaa'].map(p => (
            <span key={p} className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{p}</span>
          ))}
        </div>
      </section>

      {/* Category Browser */}
      <CategoryBrowser />

      {/* Trending Deals Grid */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
        <h2
            className="text-2xl font-bold section-heading"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            Trending Now
          </h2>
          <div className="flex items-center gap-3">
            {trendingIsStale && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                ⚠ Prices may vary
              </span>
            )}
            <Link href="/deals/feed" className="gold-link text-sm font-semibold">
              View All →
            </Link>
          </div>
        </div>

        {trendingDeals.length > 0 ? (
          <div className="deal-card-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {trendingDeals.map((deal) => (
              <DealCard key={deal._id} deal={deal} />
            ))}
          </div>
        ) : (
          <div
            className="w-full h-40 flex items-center justify-center rounded-xl border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
          >
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
              No trending deals found. (Run the Python scraper to populate MongoDB)
            </p>
          </div>
        )}
      </section>

      {/* New Today Grid */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
        <h2
            className="text-2xl font-bold section-heading"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            New Today
          </h2>
          <div className="flex items-center gap-3">
            {newIsStale && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                ⚠ Prices may vary
              </span>
            )}
            <Link href="/deals/feed?sort=newest" className="gold-link text-sm font-semibold">
              View All →
            </Link>
          </div>
        </div>

        {newDeals.length > 0 ? (
          <div className="deal-card-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {newDeals.map((deal) => (
              <DealCard key={deal._id} deal={deal} />
            ))}
          </div>
        ) : (
          <div
            className="w-full h-40 flex items-center justify-center rounded-xl border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
          >
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
              No new deals found today.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

