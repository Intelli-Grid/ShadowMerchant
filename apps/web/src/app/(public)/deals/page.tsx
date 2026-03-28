import { Suspense } from 'react';
import { DealCard } from '@/components/deals/DealCard';
import { UpgradeCTA } from '@/components/pro/UpgradeCTA';
import { FilterSidebar } from '@/components/deals/FilterSidebar';
import { Deal } from '@/types';

async function getDeals(searchParams: { [key: string]: string | undefined }) {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    
    const query: any = { is_active: true };
    
    // Platform Match
    if (searchParams.platform && searchParams.platform !== 'all') {
      query.source_platform = searchParams.platform.toLowerCase();
    }
    
    // Exact Category Match (Universal Taxonmy)
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

    const [deals, total] = await Promise.all([
      DealModel.find(query).sort(sortObj).limit(72).lean(),
      DealModel.countDocuments(query)
    ]);

    return { deals: JSON.parse(JSON.stringify(deals)), total };
  } catch (e) {
    console.error(e);
    return { deals: [], total: 0 };
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
              Live Feed
              <span
                className="font-semibold text-sm px-2.5 py-1 rounded-full"
                style={{ color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
              >
                {data.total} matches
              </span>
            </h1>
          </div>

          {/* Pro upsell banner */}
          <div className="mb-8">
            <UpgradeCTA />
          </div>

          {deals.length > 0 ? (
            <div className="space-y-12">
              {Object.entries(groupedDeals).map(([groupName, groupDeals]) => {
                if (groupDeals.length === 0) return null;
                return (
                  <div key={groupName}>
                    {showGrouped && (
                      <h2 className="text-lg font-bold text-gray-400 mb-6 flex items-center gap-2">
                        <span className="w-8 h-px bg-gray-700"></span>
                        {groupName}
                        <span className="w-full flex-1 h-px bg-gray-800"></span>
                      </h2>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {groupDeals.map((deal) => (
                        <DealCard key={deal._id} deal={deal} isUserPro={false} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
             <div className="w-full py-32 flex flex-col items-center justify-center rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
              <span className="text-4xl mb-4">🛸</span>
              <p className="text-white font-bold text-lg">No deals match your filters.</p>
              <p className="text-gray-500 mt-2 text-sm max-w-sm text-center">Try opening up your category selection, or expand the active days to search further back in time.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
