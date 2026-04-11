import { Suspense } from 'react';
import { DealCard } from '@/components/deals/DealCard';
import { LoadMoreDeals } from '@/components/deals/LoadMoreDeals';
import { FilterSidebar } from '@/components/deals/FilterSidebar';
import { Deal } from '@/types';
import { redis, CACHE_TTL } from '@/lib/redis';

export async function generateMetadata({ searchParams }: any) {
  const p = await searchParams;
  const hasFilters = p.category || p.platform || (p.sort && p.sort !== 'score');
  return {
    title: 'Deal Feed — ShadowMerchant',
    robots: hasFilters ? 'noindex, follow' : 'index, follow',
  };
}

async function getDeals(searchParams: { [key: string]: string | undefined }) {
  // Build cache key from params
  const cacheKey = `deals:feed:${JSON.stringify(searchParams)}`;
  const cached = await redis.get<{ deals: Deal[]; total: number; hasMore: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    
    const query: any = { is_active: true };
    
    // Platform Match
    if (searchParams.platform && searchParams.platform !== 'all') {
      query.source_platform = searchParams.platform.toLowerCase();
    }
    
    // Exact Category Match (Universal Taxonomy)
    if (searchParams.category && searchParams.category !== 'all') {
      query.category = searchParams.category.toLowerCase();
    }

    // Days Active Filter
    const days = parseInt(searchParams.days || '7', 10);
    if (!isNaN(days) && days > 0) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      query.scraped_at = { $gte: dateLimit };
    }

    // Sorting
    let sortObj: any = { deal_score: -1 };
    if (searchParams.sort === 'discount') sortObj = { discount_percent: -1 };
    if (searchParams.sort === 'newest') sortObj = { scraped_at: -1 };
    if (searchParams.sort === 'price_asc') sortObj = { discounted_price: 1 };
    if (searchParams.sort === 'price_desc') sortObj = { discounted_price: -1 };

    const PAGE_SIZE = 24;
    const [deals, total] = await Promise.all([
      DealModel.find(query).sort(sortObj).limit(PAGE_SIZE).lean(),
      DealModel.countDocuments(query)
    ]);

    const result = { deals: JSON.parse(JSON.stringify(deals)), total, hasMore: total > PAGE_SIZE };
    // Cache for 5 min — safe since scraper runs every 6 hours
    await redis.set(cacheKey, result, { ex: CACHE_TTL.DEAL_LIST });
    return result;
  } catch (e) {
    console.error(e);
    return { deals: [], total: 0, hasMore: false };
  }
}

// Group deals by relative day
function groupDealsByDay(deals: Deal[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(now);
  thisWeek.setDate(thisWeek.getDate() - 7);

  const groups: Record<string, Deal[]> = {
    'Today': [],
    'Yesterday': [],
    'Earlier This Week': [],
    'Older': []
  };

  deals.forEach((deal) => {
    const dt = new Date(deal.scraped_at);
    dt.setHours(0, 0, 0, 0);

    if (dt.getTime() === today.getTime()) {
      groups['Today'].push(deal);
    } else if (dt.getTime() === yesterday.getTime()) {
      groups['Yesterday'].push(deal);
    } else if (dt > thisWeek) {
      groups['Earlier This Week'].push(deal);
    } else {
      groups['Older'].push(deal);
    }
  });

  return groups;
}

export default async function DealsFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const data = await getDeals(resolvedParams);

  const deals: Deal[] = data.deals || [];
  
  const currentSort = resolvedParams.sort || 'score';
  const showGrouped = currentSort === 'newest';
  
  const groupedDeals = showGrouped ? groupDealsByDay(deals) : { 'All Deals': deals };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8 relative items-start">
        
        {/* Interactive Filter Sidebar */}
        <Suspense fallback={<div className="w-64 h-96 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />}>
          <FilterSidebar />
        </Suspense>

        {/* Feed Grid */}
        <section className="flex-1 min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-3">
              Live Deals
              <span
                className="font-semibold text-sm px-2.5 py-1 rounded-full"
                style={{ color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
              >
                {data.total} active
              </span>
              {!resolvedParams.category && !resolvedParams.platform && (
                <span className="text-xs font-medium hidden sm:inline"
                  style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                  · refreshed today
                </span>
              )}
            </h1>
          </div>

          {deals.length > 0 ? (
            <div className="space-y-12">
              {Object.entries(groupedDeals).map(([groupName, groupDeals]) => {
                if (groupDeals.length === 0) return null;
                return (
                  <div key={groupName}>
                    {showGrouped && (
                      <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <span className="w-8 h-px" style={{ background: 'var(--sm-border)' }}></span>
                        {groupName}
                        <span className="w-full flex-1 h-px" style={{ background: 'var(--sm-border)' }}></span>
                      </h2>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                      {groupDeals.map((deal) => (
                        <DealCard key={deal._id} deal={deal} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Load More — client-side pagination */}
              <LoadMoreDeals
                initialHasMore={data.hasMore ?? false}
                searchParams={resolvedParams}
              />
            </div>
          ) : (
            <div className="w-full py-24 flex flex-col items-center justify-center rounded-2xl border text-center"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
              <div className="text-6xl mb-4 opacity-40">🔍</div>
              <p className="text-white font-bold text-xl mb-2">No deals match your filters.</p>
              <p className="text-sm max-w-xs text-center mb-8" style={{ color: 'var(--text-muted)' }}>
                Try broadening your search — great deals are waiting.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <a href="/deals" className="px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors"
                  style={{ background: 'var(--bg-raised)', borderColor: 'var(--sm-border)', color: 'var(--text-primary)' }}>
                  Show All Categories
                </a>
                <a href="/deals?sort=score" className="px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors"
                  style={{ background: 'var(--bg-raised)', borderColor: 'var(--sm-border)', color: 'var(--text-primary)' }}>
                  Top Deals
                </a>
                <a href="/deals?sort=newest" className="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{ background: 'var(--gold)', color: '#0A0A0A' }}>
                  🆕 View Recent
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
