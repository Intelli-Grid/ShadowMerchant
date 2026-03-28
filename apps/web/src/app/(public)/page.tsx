import { DealCard } from '@/components/deals/DealCard';
import { CategoryBrowser } from '@/components/CategoryBrowser';
import { Deal } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
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
  // Trending deals are shown to everyone — no pro gating on homepage
  const trendingDeals: Deal[] = await getTrendingDeals();

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
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">

        {/* Logo mark above hero */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24 logo-breathe">
            <Image
              src="/logo.png"
              alt="ShadowMerchant"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Live deal counter */}
        {trendingDeals.length > 0 && (
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold mb-6"
            style={{
              background: 'var(--gold-dim)',
              border: '1px solid var(--gold-border)',
              color: 'var(--gold)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: 'var(--gold)' }}
            />
            {trendingDeals.length} deals live right now
          </div>
        )}

        {/* Hero badge */}
        <Badge
          className="mb-4 font-semibold px-4 py-1.5"
          style={{
            background: 'var(--gold-dim)',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
          }}
          variant="secondary"
        >
          ⚡ {trendingDeals.length > 0
            ? `${trendingDeals.length} Top Deals Found`
            : "India's Best Deals, All in One Place"}
        </Badge>

        {/* Main headline */}
        <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-white leading-tight">
          Stop hunting across 10 apps. <br className="hidden md:block" />
          <span className="text-gold-shimmer">
            The best deals find you.
          </span>
        </h1>

        <p className="text-lg md:text-xl mb-4 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          ShadowMerchant automatically discovers &amp; scores the best-discounted products from Amazon, Flipkart, Myntra, and more. All in one place.
        </p>

        {/* Savings counter */}
        {totalSavings > 0 && (
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Combined savings available today:{' '}
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formattedSavings}</span>
          </p>
        )}

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 flex-wrap mb-10">
          <Link
            href="/deals/feed"
            className="btn-gold inline-flex items-center gap-2 py-4 px-8 rounded-xl text-base"
          >
            View Deal Feed
          </Link>
          <Link
            href="/pro"
            className="btn-gold-outline inline-flex items-center gap-2 py-4 px-8 rounded-xl text-base"
          >
            <span style={{ color: 'var(--gold)' }}>✦</span> Upgrade to Pro
          </Link>
        </div>

        {/* Platform trust badges */}
        <div className="flex items-center justify-center gap-4 flex-wrap opacity-70">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Deals from
          </span>
          {['🛒 Amazon', '🔵 Flipkart', '👗 Myntra', '🛍️ Meesho', '💄 Nykaa'].map(p => (
            <span key={p} className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{p}</span>
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
          <Link href="/deals/feed" className="text-sm font-semibold transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            View All →
          </Link>
        </div>

        {trendingDeals.length > 0 ? (
          <div className="deal-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {trendingDeals.map((deal) => (
              // isUserPro=true: trending deals are always fully visible on homepage
              // The pro lock only appears on the Deal Feed page
              <DealCard key={deal._id} deal={deal} isUserPro={true} />
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
    </main>
  );
}

// Inline Badge component
function Badge({ children, className, style, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={`inline-flex items-center rounded-full text-xs transition-colors focus:outline-none ${className ?? ''}`}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}
