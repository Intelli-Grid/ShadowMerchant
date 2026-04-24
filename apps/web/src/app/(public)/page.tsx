import { DealCard } from '@/components/deals/DealCard';
import { CategoryBrowser } from '@/components/CategoryBrowser';
import { HeroDeal } from '@/components/HeroDeal';
import { BentoGrid } from '@/components/BentoGrid';
import { CategorySwimlane } from '@/components/CategorySwimlane';
import { ReturnBanner } from '@/components/ReturnBanner';
import { HeroSearchBar } from '@/components/HeroSearchBar';
import { HowItWorks } from '@/components/HowItWorks';
import { TelegramCTA } from '@/components/TelegramCTA';
import { WhatsAppCTA } from '@/components/WhatsAppCTA';
import { Badge } from '@/components/ui/badge';
import { Deal } from '@/types';
import Link from 'next/link';
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
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Primary: top 5 trending deals scraped within last 48 hours
    let candidates = await DealModel.find({
      is_active: true,
      is_trending: true,
      scraped_at: { $gte: cutoff48h },
      deal_score: { $gte: 60 },                    // Hero must be Good Deal or better
      discount_percent: { $lte: 85 },              // No suspect discounts as Hero
      image_url: { $exists: true, $ne: '' },        // Hero must have an image
      title: { $regex: '.{20,}' },                 // Hero must have a proper title
    })
      .sort({ deal_score: -1 })
      .limit(5)
      .lean();

    // Fallback: any active trending deal regardless of age
    if (!candidates || candidates.length === 0) {
      candidates = await DealModel.find({ is_active: true, is_trending: true })
        .sort({ deal_score: -1 })
        .limit(5)
        .lean();
    }

    if (candidates && candidates.length > 0) {
      // Rotate the hero daily — day-index offset so it changes every 24h
      const dayIndex = Math.floor(Date.now() / 86_400_000);
      const deal = candidates[dayIndex % candidates.length];
      const result = JSON.parse(JSON.stringify(deal));
      await redis.set('deals:hero', result, { ex: 900 }); // 15 min TTL
      return result;
    }
  } catch {}
  return null;
}

async function getCategoryDeals(category: string, limit = 8) {
  // Cache per-category for 30 min — cleared by refresh cron after each pipeline run
  const cacheKey = `deals:category:${category}`;
  const cached = await redis.get<Deal[]>(cacheKey);
  if (cached) return cached;
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    // Platform-diversity aggregation: cap at 2 deals per platform per category.
    // Prevents Meesho-dominated swimlanes when one platform dominates the database.
    const MAX_PER_PLATFORM = 2;
    const deals = await DealModel.aggregate([
      {
        $match: {
          is_active: true,
          category,
          deal_score: { $gte: 30 },       // Exclude very low quality deals
          title: { $regex: '.{15,}' },    // Exclude garbage/short titles
        },
      },
      { $sort: { deal_score: -1 } },
      { $group: { _id: '$source_platform', docs: { $push: '$$ROOT' } } },
      { $project: { docs: { $slice: ['$docs', MAX_PER_PLATFORM] } } },
      { $unwind: '$docs' },
      { $replaceRoot: { newRoot: '$docs' } },
      { $sort: { deal_score: -1 } },
      { $limit: limit },
    ]);
    const result = JSON.parse(JSON.stringify(deals));
    await redis.set(cacheKey, result, { ex: 1800 }); // 30 min TTL
    return result;
  } catch {
    return [];
  }
}

async function getLastRefreshed(): Promise<string> {
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    // Find the most recently scraped deal as a proxy for last pipeline run
    const latest = await DealModel.findOne({ is_active: true })
      .sort({ scraped_at: -1 })
      .select('scraped_at')
      .lean();
    if (latest?.scraped_at) {
      const diff = Math.floor((Date.now() - new Date(latest.scraped_at).getTime()) / 60000);
      if (diff < 60) return `${diff}m ago`;
      const hrs = Math.floor(diff / 60);
      return `${hrs}h ago`;
    }
  } catch {}
  return 'recently';
}

// Daily rotating category swimlane — advances one slot per day.
// Add/remove entries freely; the modulo ensures no out-of-bounds.
const ROTATING_CATEGORIES = [
  { slug: 'electronics', title: 'Electronics Deals',  emoji: '💻' },
  { slug: 'fashion',     title: 'Fashion Deals',       emoji: '👗' },
  { slug: 'beauty',      title: 'Beauty & Skincare',   emoji: '✨' },
  { slug: 'home',        title: 'Home & Kitchen',      emoji: '🏠' },
  { slug: 'sports',      title: 'Sports & Fitness',    emoji: '🏋️' },
  { slug: 'gaming',      title: 'Gaming Deals',        emoji: '🎮' },
] as const;

export default async function Home() {

  // Deterministic daily category rotation (changes at midnight UTC)
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const featuredCategory = ROTATING_CATEGORIES[dayIndex % ROTATING_CATEGORIES.length];

  // Parallelise all data fetching
  const [trendingResult, newResult, heroDeal, featuredCategoryDeals, lastRefreshed] = await Promise.all([
    getTrendingDeals(),
    getNewDealsToday(),
    getHeroDeal(),
    getCategoryDeals(featuredCategory.slug, 8),
    getLastRefreshed(),
  ]);

  // Frontend quality gate: only display trending deals with score >= 50.
  // Falls back to raw results if fewer than 4 quality deals are available,
  // ensuring the section never appears empty.
  const qualityTrendingDeals = trendingResult.deals.filter((d: Deal) => (d.deal_score ?? 0) >= 50);
  const trendingDeals = qualityTrendingDeals.length >= 4 ? qualityTrendingDeals : trendingResult.deals;
  const trendingIsStale = trendingResult.isStale;
  const newIsStale = newResult.isStale;

  // T3-E: Deduplicate newDeals — remove any deal already shown in trendingDeals
  const trendingIds = new Set(trendingDeals.map((d) => String(d._id)));
  const newDeals = newResult.deals.filter((d) => !trendingIds.has(String(d._id)));

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
            <span>🕐 Updated {lastRefreshed}</span>
          </div>
        )}



        {/* Platform trust badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6 hover:opacity-100 transition-opacity">
          {['📦 Amazon', '🛒 Flipkart', '👗 Myntra', '🛍️ Meesho', '💄 Nykaa'].map(p => (
            <span key={p} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--sm-border)' }}>
              {p}
            </span>
          ))}
        </div>

        {/* T2-D: Hero Search Bar */}
        <div className="w-full max-w-xl mx-auto">
          <HeroSearchBar />
        </div>
      </section>

      {/* HeroDeal Component */}
      {heroDeal && (
        <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
          <HeroDeal deal={heroDeal} />
        </section>
      )}

      {/* T3-A: How It Works - Disabled per request */}
      {/* <HowItWorks /> */}

      {/* T3-B: Category Browser — with #categories anchor */}
      <section id="categories" className="w-full">
        <CategoryBrowser />
      </section>

      {/* Daily Rotating Category Swimlane */}
      {featuredCategoryDeals.length > 0 && (
        <section className="w-full pb-10">
          <CategorySwimlane
            title={featuredCategory.title}
            emoji={featuredCategory.emoji}
            categorySlug={featuredCategory.slug}
            deals={featuredCategoryDeals}
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

      {/* T3-C: Telegram CTA Banner */}
      <TelegramCTA />
      {/* WhatsApp CTA Banner — companion channel, sits directly below Telegram */}
      <WhatsAppCTA />
    </main>
  );
}

