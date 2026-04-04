import { HeroDeal } from '@/components/HeroDeal';
import { BentoGrid } from '@/components/BentoGrid';
import { PlatformFilter } from '@/components/PlatformFilter';
import { CategorySwimlane } from '@/components/CategorySwimlane';
import Link from 'next/link';
import { connectDB } from '@/lib/db';

export const revalidate = 21600; // ISR cache logic: 6 hours matches scrape frequency

async function getDealsData(platform?: string) {
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;

    // Show ALL active deals — free shown normally, pro shown as locked teasers
    const baseQuery: any = { is_active: true };
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
      { slug: 'electronics', title: 'Top Electronics', emoji: '💻' },
      { slug: 'fashion', title: 'Trending Fashion', emoji: '👗' },
      { slug: 'beauty', title: 'Beauty & Health', emoji: '💄' },
      { slug: 'home', title: 'Home & Kitchen', emoji: '🏠' }
    ];

    const swimlanes = await Promise.all(
      categories.map(async (cat) => {
        // BUG-06: Use exact slug match (hits compound index) instead of regex (full scan)
        const catQuery = { ...baseQuery, category: cat.slug };
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
              <div
                className="flex flex-col md:flex-row items-center justify-between p-8 md:p-12 rounded-[24px] overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-overlay) 100%)',
                  border: '1px solid var(--gold-border)',
                  boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.05)',
                }}
              >
                {/* Gold glow blob */}
                <div
                  className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-15 pointer-events-none"
                  style={{ background: 'var(--gold)' }}
                />
                {/* Gold left bar accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[24px]"
                  style={{ background: 'linear-gradient(to bottom, var(--gold-bright), var(--gold))' }}
                />

                <div className="flex flex-col gap-3 relative z-10 text-center md:text-left mb-6 md:mb-0 md:pl-6">
                  <span
                    className="font-bold uppercase tracking-wider text-sm flex items-center justify-center md:justify-start gap-2"
                    style={{ color: 'var(--gold)' }}
                  >
                    <span className="text-xl">✦</span> Level Up Your Savings
                  </span>
                  <h3
                    className="text-2xl md:text-4xl font-black text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Unlock{' '}
                    <span className="heading-gold">Deal Intelligence</span>
                  </h3>
                  <p className="max-w-lg mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Know when to buy. Get instant WhatsApp alerts for price drops, view full 30-day price histories, and set custom deal rules.
                  </p>
                </div>

                <Link
                  href="/pro"
                  className="relative z-10 w-full md:w-auto text-center font-bold px-8 py-4 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'var(--gold)', color: '#0A0A0A' }}
                >
                  Upgrade to Pro →
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}

    </main>
  );
}
