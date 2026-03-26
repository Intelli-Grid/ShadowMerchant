import { DealCard } from '@/components/deals/DealCard';
import { HeroDeal } from '@/components/HeroDeal';
import { BentoGrid } from '@/components/BentoGrid';
import { PlatformFilter } from '@/components/PlatformFilter';
import { CategorySwimlane } from '@/components/CategorySwimlane';
import { Deal } from '@/types';
import Link from 'next/link';

export const revalidate = 21600; // ISR cache logic: 6 hours matches scrape frequency

async function getDealsData(platform?: string) {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;

    const baseQuery: any = { is_active: true, is_pro_exclusive: false };
    if (platform) baseQuery.source_platform = platform;

    // Fetch the #1 highest-scored deal for the Hero banner
    const heroDeal = await DealModel.findOne(baseQuery)
      .sort({ deal_score: -1 })
      .lean();

    // Fetch next 9 top deals for Bento Grid
    const topDeals = await DealModel.find(baseQuery)
      .sort({ deal_score: -1 })
      .skip(heroDeal ? 1 : 0)
      .limit(9)
      .lean();

    // Fetch swimlanes using generic DB aggregation or multiple finds
    // For performance, we'll do 4 parallel finds for the 4 primary categories
    const categories = [
      { slug: 'electronics', title: 'Top Electronics', emoji: '💻', keyword: /electronic|mobile|laptop|gadget/i },
      { slug: 'fashion', title: 'Trending Fashion', emoji: '👗', keyword: /fashion|clothing|apparel/i },
      { slug: 'beauty', title: 'Beauty & Health', emoji: '💄', keyword: /beauty|makeup|skincare/i },
      { slug: 'home', title: 'Home & Kitchen', emoji: '🏠', keyword: /home|kitchen|furniture/i }
    ];

    const swimlanes = await Promise.all(
      categories.map(async (cat) => {
        const catQuery = { ...baseQuery, category: { $regex: cat.keyword } };
        const raw = await DealModel.find(catQuery)
          .sort({ deal_score: -1 })
          .limit(10)
          .lean();

        // Round-robin trick
        const groups: Record<string, any[]> = {};
        for (const deal of raw) {
          const p = deal.source_platform || 'unknown';
          if (!groups[p]) groups[p] = [];
          groups[p].push(deal);
        }

        const interleaved: any[] = [];
        const platforms = Object.keys(groups);
        const maxLen = Math.max(0, ...platforms.map(p => groups[p].length));
        
        for (let i = 0; i < maxLen; i++) {
          for (const p of platforms) {
            if (groups[p][i]) interleaved.push(groups[p][i]);
          }
        }

        return {
          title: cat.title,
          emoji: cat.emoji,
          categorySlug: cat.slug,
          deals: interleaved,
        };
      })
    );

    return {
      hero: heroDeal ? JSON.parse(JSON.stringify(heroDeal)) : null,
      topDeals: JSON.parse(JSON.stringify(topDeals)),
      swimlanes: JSON.parse(JSON.stringify(swimlanes.filter(s => s.deals.length > 0))),
    };

  } catch (e) {
    console.error('getDealsData error:', e);
    return { hero: null, topDeals: [], swimlanes: [] };
  }
}

export default async function DealFeedPage({ searchParams }: { searchParams: Promise<{ platform?: string }> }) {
  // Await the entire searchParams promise (Next.js 15+ requirement)
  const resolvedParams = await searchParams;
  const platform = resolvedParams?.platform;
  
  const { hero, topDeals, swimlanes } = await getDealsData(platform);

  return (
    <main className="flex-1 w-full flex flex-col items-center pb-20">
      
      {/* Sticky Filter Strip */}
      <PlatformFilter />

      {/* Primary Section */}
      {hero ? (
        <HeroDeal deal={hero} />
      ) : (
        <div className="w-full text-center py-24 text-gray-500">
          No deals found. Check back later or run the scraper.
        </div>
      )}

      {/* Grid of the remaining top deals */}
      {topDeals.length > 0 && <BentoGrid deals={topDeals} />}

      {/* Category Editorials */}
      {swimlanes.map((lane: any, idx: number) => (
        <div key={lane.categorySlug || idx} className="w-full">
          <CategorySwimlane 
            title={lane.title}
            emoji={lane.emoji}
            categorySlug={lane.categorySlug}
            deals={lane.deals}
          />

          {/* Upgrade CTA between row 2 and 3 */}
          {idx === 1 && (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 my-4">
              <div className="flex flex-col md:flex-row items-center justify-between p-8 md:p-12 rounded-[24px] overflow-hidden relative shadow-2xl shadow-purple-900/20" style={{ background: 'linear-gradient(135deg, var(--bg-surface), #1A1025)', border: '1px solid #3B1B6B' }}>
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-600 rounded-full blur-[120px] opacity-20 pointer-events-none" />
                
                <div className="flex flex-col gap-3 relative z-10 text-center md:text-left mb-6 md:mb-0">
                  <span className="text-purple-400 font-bold uppercase tracking-wider text-sm flex items-center justify-center md:justify-start gap-2">
                    <span className="text-xl">⚡</span> Level Up Your Savings
                  </span>
                  <h3 className="text-2xl md:text-4xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    Unlock <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">Pro Exclusives</span>
                  </h3>
                  <p className="text-gray-400 max-w-lg mt-2 font-medium">
                    Get instant WhatsApp alerts for price drops, access flash sales 30 minutes early, and unlock the highest-scored hidden deals.
                  </p>
                </div>
                
                <Link 
                  href="/pro" 
                  className="relative z-10 w-full md:w-auto text-center bg-white text-black font-bold px-8 py-4 rounded-xl hover:scale-105 active:scale-95 transition-transform"
                >
                  Start Pro Free Trial →
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}

    </main>
  );
}
