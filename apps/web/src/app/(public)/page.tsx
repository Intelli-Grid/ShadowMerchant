import { DealCard } from '@/components/deals/DealCard';
import { CategoryBrowser } from '@/components/CategoryBrowser';
import { HeroDeal } from '@/components/HeroDeal';
import { BentoGrid } from '@/components/BentoGrid';
import { CategorySwimlane } from '@/components/CategorySwimlane';
import { ReturnBanner } from '@/components/ReturnBanner';
import { Badge } from '@/components/ui/badge';
import { Deal } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { connectDB } from '@/lib/db';
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
  // BUG-08: Cache this to avoid MongoDB query on every homepage request
  const cached = await redis.get<{ deals: Deal[]; isStale: boolean }>('deals:new_today');
  if (cached) return cached;

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

    const result = { deals: JSON.parse(JSON.stringify(deals)), isStale };
    // Cache for 15 min — cron job clears this key after each pipeline run
    await redis.set('deals:new_today', result, { ex: 900 });
    return result;
  } catch (e) {
    console.error('getNewDealsToday error:', e);
    return { deals: [], isStale: false };
  }
}


async function getHeroDeal(): Promise<Deal | null> {
  const cached = await redis.get<Deal>('deals:hero');
  if (cached) return cached;
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    const deal = await DealModel.findOne({ is_active: true, is_trending: true })
      .sort({ deal_score: -1 })
      .lean();
    if (deal) {
      const result = JSON.parse(JSON.stringify(deal));
      await redis.set('deals:hero', result, { ex: 900 });
      return result;
    }
  } catch {}
  return null;
}

async function getCategoryDeals(category: string, limit = 8) {
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    const deals = await DealModel.find({ is_active: true, category })
      .sort({ deal_score: -1 })
      .limit(limit)
      .lean();
    return JSON.parse(JSON.stringify(deals));
  } catch {
    return [];
  }
}

export default async function Home() {

  // Parallelise all data fetching
  const [trendingResult, newResult, heroDeal, electronicsDeals] = await Promise.all([
    getTrendingDeals(),
    getNewDealsToday(),
    getHeroDeal(),
    getCategoryDeals('electronics', 8)
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
      <ReturnBanner />
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
          ⚡ {totalSavings > 0
            ? `Save up to ${formattedSavings} today`
            : "India's Best Deals, All in One Place"}
        </Badge>

        {/* Main headline - Compacted */}
        <h1 className="text-2xl md:text-4xl font-black mb-3 tracking-tight text-white leading-tight max-w-3xl">
          Stop hunting across 10 apps. <br className="hidden md:block" />
          <span className="text-gold-shimmer">The best deals find you.</span>
        </h1>

        <p className="text-sm md:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          ShadowMerchant automatically discovers &amp; scores the best-discounted products from Amazon, Flipkart, Myntra, and more.
        </p>

        {trendingDeals.length > 0 && (
          <div className="flex items-center justify-center gap-2 sm:gap-6 text-[10px] sm:text-xs font-semibold mt-4 mb-6 flex-wrap"
            style={{ color: 'var(--text-muted)' }}>
            <span>🔥 {trendingDeals.length} hot deals right now</span>
            <span className="hidden sm:inline">·</span>
            <span>💰 {formattedSavings} saveable today</span>
            <span className="hidden sm:inline">·</span>
            <span>🕐 Refreshes 3× daily</span>
          </div>
        )}

        {/* Affiliate disclosure banner */}
        <div className="w-full max-w-7xl px-4 py-2 text-center mb-6 z-10 relative">
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            ℹ️ ShadowMerchant earns affiliate commissions on purchases. Deals are ranked by savings quality, not commission rate.
          </p>
        </div>

        {/* Platform trust badges - Extremely subtle */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-4 hover:opacity-100 transition-opacity">
          {['🛒 Amazon', '🔵 Flipkart', '👗 Myntra', '🛍️ Meesho', '💄 Nykaa'].map(p => (
            <span key={p} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--sm-border)' }}>
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* HeroDeal Component */}
      {heroDeal && (
        <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
          <HeroDeal deal={heroDeal} />
        </section>
      )}

      {/* Category Browser */}
      <CategoryBrowser />

      {/* Category Swimlane */}
      {electronicsDeals.length > 0 && (
        <section className="w-full pb-10">
          <CategorySwimlane
            title="Electronics Deals"
            emoji="💻"
            categorySlug="electronics"
            deals={electronicsDeals}
          />
        </section>
      )}

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
            {trendingIsStale ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                🕐 Next refresh: 6h window
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                ✓ Live — Updated today
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

      {/* Bento Grid */}
      {trendingDeals.length >= 5 && (
        <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <BentoGrid deals={trendingDeals} />
        </section>
      )}

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
            {newIsStale ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                🕐 Next refresh: 6h window
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                ✓ Live — Updated today
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

