import { Suspense } from 'react';
import { DealCard } from '@/components/deals/DealCard';
import { UpgradeCTA } from '@/components/pro/UpgradeCTA';
import { Deal } from '@/types';

async function getDeals(searchParams: { [key: string]: string | string[] | undefined }) {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;
    
    const query: any = { is_active: true };
    if (searchParams.platform) query.source_platform = (searchParams.platform as string).toLowerCase();
    
    // Category mapping (similar to API logic)
    if (searchParams.category) {
      const cat = (searchParams.category as string).toLowerCase();
      if (cat === 'electronics') {
        query.category = { $in: ['Electronics', 'Laptops', 'Mobiles', 'Audio'] };
      } else if (cat === 'fashion') {
        query.category = { $in: ['Fashion', 'Clothing', 'Shoes', 'Accessories'] };
      } else if (cat === 'beauty') {
        query.category = { $in: ['Beauty', 'Personal Care', 'Makeup'] };
      } else {
        query.category = new RegExp(cat, 'i');
      }
    }

    let sortObj: any = { deal_score: -1 };
    if (searchParams.sort === 'discount') sortObj = { discount_percent: -1 };
    if (searchParams.sort === 'newest') sortObj = { published_at: -1 };

    const [deals, total] = await Promise.all([
      Deal.find(query).sort(sortObj).limit(48).lean(),
      Deal.countDocuments(query)
    ]);

    return { deals: JSON.parse(JSON.stringify(deals)), total };
  } catch (e) {
    console.error(e);
    return { deals: [], total: 0 };
  }
}

export default async function DealsFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const data = await getDeals(resolvedParams);
  const deals: Deal[] = data.deals || [];

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters (Basic implementation for now) */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-[#13131A] p-6 rounded-xl border border-[#2A2A35] sticky top-8">
            <h3 className="font-bold text-lg mb-4 text-white">Filter Deals</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Platform</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-[#FF6B00] w-4 h-4 rounded bg-[#1A1A24] border-[#2A2A35]" />
                    <span className="text-gray-300">Amazon</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-[#FF6B00] w-4 h-4 rounded bg-[#1A1A24] border-[#2A2A35]" />
                    <span className="text-gray-300">Flipkart</span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Sort By</h4>
                <select className="w-full bg-[#1A1A24] border border-[#2A2A35] text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#FF6B00]">
                  <option value="score">Highest Score (AI)</option>
                  <option value="discount">Biggest Discount</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>
            
          </div>
        </aside>

        {/* Feed Grid */}
        <section className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              All Top Deals <span className="text-gray-500 font-normal text-lg ml-2">({data.total || deals.length} found)</span>
            </h1>
          </div>

          {/* Pro upsell banner */}
          <div className="mb-6">
            <UpgradeCTA />
          </div>

          {deals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal) => (
                <DealCard key={deal._id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="w-full py-20 flex flex-col items-center justify-center bg-[#13131A] rounded-xl border border-[#2A2A35] text-center px-4">
              <span className="text-4xl mb-4">🛒</span>
              <h3 className="text-xl font-bold text-white mb-2">No deals matched</h3>
              <p className="text-gray-500 max-w-sm">Try tweaking your filters or check back soon once the scraper brings in new deals.</p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
