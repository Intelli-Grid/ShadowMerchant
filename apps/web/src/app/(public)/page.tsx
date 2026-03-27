import { DealCard } from '@/components/deals/DealCard';
import { CategoryBrowser } from '@/components/CategoryBrowser';
import { Deal } from '@/types';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';

// Fetch the top 8 trending deals (is_trending=true, mix of free + pro)
async function getTrendingDeals(): Promise<Deal[]> {
  try {
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;
    const deals = await DealModel.find({ is_active: true, is_trending: true })
      .sort({ deal_score: -1 })
      .limit(8)
      .lean();
    return JSON.parse(JSON.stringify(deals));
  } catch (e) {
    console.error('getTrendingDeals error:', e);
    return [];
  }
}

export default async function Home() {
  const { userId } = await auth();
  const trendingDeals: Deal[] = await getTrendingDeals();

  // Check if user has pro subscription
  let isUserPro = false;
  if (userId) {
    try {
      await connectDB();
      const User = (await import('@/models/User')).default;
      const user = await User.findOne({ clerk_id: userId }).select('subscription').lean() as any;
      isUserPro = user?.subscription?.plan === 'pro' && user?.subscription?.status === 'active';
    } catch { /* non-fatal */ }
  }

  return (
    <main className="flex-1 w-full flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <Badge className="mb-4 bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00]/20 font-semibold px-4 py-1.5" variant="secondary">
          ⚡ {trendingDeals.length > 0 ? `${trendingDeals.length} Top Deals Found` : 'India\'s Best Deals, All in One Place'}
        </Badge>
        <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-white leading-tight">
          Stop hunting across 10 apps. <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-[#FF9900]">
            The best deals find you.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          ShadowMerchant automatically discovers & scores the best-discounted products from Amazon, Flipkart, Myntra, and more. All in one place.
        </p>
        
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/deals/feed" className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold py-4 px-8 rounded-lg shadow-lg shadow-[#FF6B00]/20 transition-all hover:scale-105 active:scale-95">
            View Deal Feed
          </Link>
          <Link href="/pro" className="bg-[#1A1A24] border border-[#2A2A35] hover:border-[#7C3AED] hover:text-[#7C3AED] text-white font-bold py-4 px-8 rounded-lg transition-all">
            Upgrade to Pro
          </Link>
        </div>
      </section>

      {/* Category Browser */}
      <CategoryBrowser />

      {/* Trending Deals Grid */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white flex gap-2 items-center">
            <span className="w-2 h-8 rounded bg-[#FF6B00]"></span> Trending Now
          </h2>
          <Link href="/deals/feed" className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">
            View All →
          </Link>
        </div>

        {trendingDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {trendingDeals.map((deal) => (
              <DealCard key={deal._id} deal={deal} isUserPro={isUserPro} />
            ))}
          </div>
        ) : (
          <div className="w-full h-40 flex items-center justify-center bg-[#13131A] rounded-xl border border-[#2A2A35]">
            <p className="text-gray-500 font-medium">No trending deals found. (Run the Python scraper to populate MongoDB)</p>
          </div>
        )}
      </section>
    </main>
  );
}

// Temporary inline Badge component until we generate Shadcn fully in this file
function Badge({ children, className, ...props }: any) {
  return <span className={`inline-flex items-center rounded-full text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`} {...props}>{children}</span>;
}
