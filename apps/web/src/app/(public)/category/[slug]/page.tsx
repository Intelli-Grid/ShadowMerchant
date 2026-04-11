import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';
import Link from 'next/link';

const CATEGORY_CONFIG: Record<string, {
  label: string;
  description: string;
  gradient: string;
  emoji: string;
  accentColor: string;
}> = {
  electronics: {
    label: 'Electronics',
    description: 'Top prices on phones, laptops, audio, and gadgets',
    gradient: 'linear-gradient(135deg, #0D1E3D 0%, #0F2552 100%)',
    emoji: '💻',
    accentColor: '#60A5FA',
  },
  fashion: {
    label: 'Fashion',
    description: 'Trending clothes, footwear & accessories from Myntra, Meesho & more',
    gradient: 'linear-gradient(135deg, #2D0A1F 0%, #4A0E2E 100%)',
    emoji: '👗',
    accentColor: '#F472B6',
  },
  beauty: {
    label: 'Beauty & Personal Care',
    description: 'Skincare, makeup, fragrances & wellness — best prices from Nykaa & more',
    gradient: 'linear-gradient(135deg, #1E0A3C 0%, #2D0F5A 100%)',
    emoji: '💄',
    accentColor: '#C084FC',
  },
  home: {
    label: 'Home & Kitchen',
    description: 'Appliances, cookware, décor & furniture — deals for every room',
    gradient: 'linear-gradient(135deg, #0A2018 0%, #0F3526 100%)',
    emoji: '🏠',
    accentColor: '#34D399',
  },
  sports: {
    label: 'Sports & Outdoors',
    description: 'Fitness gear, sports equipment & outdoor essentials',
    gradient: 'linear-gradient(135deg, #1A1A0A 0%, #2E2E0F 100%)',
    emoji: '🏋️',
    accentColor: '#FCD34D',
  },
  books: {
    label: 'Books',
    description: 'Fiction, non-fiction, textbooks & more at unbeatable prices',
    gradient: 'linear-gradient(135deg, #0F1A2A 0%, #162438 100%)',
    emoji: '📚',
    accentColor: '#94A3B8',
  },
  toys: {
    label: 'Toys & Games',
    description: 'Kids toys, board games & educational products',
    gradient: 'linear-gradient(135deg, #2A0A0A 0%, #3D0F0F 100%)',
    emoji: '🧸',
    accentColor: '#FB923C',
  },
  health: {
    label: 'Health & Nutrition',
    description: 'Supplements, vitamins & health essentials',
    gradient: 'linear-gradient(135deg, #0A2A1A 0%, #0F3D25 100%)',
    emoji: '💊',
    accentColor: '#4ADE80',
  },
  automotive: {
    label: 'Automotive & Car Care',
    description: 'Car accessories, tools & maintenance products',
    gradient: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
    emoji: '🚗',
    accentColor: '#A78BFA',
  },
  grocery: {
    label: 'Grocery & Staples',
    description: 'Everyday pantry essentials & packaged food deals',
    gradient: 'linear-gradient(135deg, #1A2A0A 0%, #263D0F 100%)',
    emoji: '🛒',
    accentColor: '#86EFAC',
  },
  travel: {
    label: 'Travel & Luggage',
    description: 'Bags, luggage, travel accessories & more',
    gradient: 'linear-gradient(135deg, #0A1A2A 0%, #0F263D 100%)',
    emoji: '✈️',
    accentColor: '#7DD3FC',
  },
  gaming: {
    label: 'Gaming',
    description: 'Consoles, controllers, games & PC peripherals',
    gradient: 'linear-gradient(135deg, #1A0A2A 0%, #2A0F3D 100%)',
    emoji: '🎮',
    accentColor: '#F0ABFC',
  },
};

const FALLBACK_CONFIG = {
  label: '',
  description: 'Top deals ranked by AI deal score',
  gradient: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)',
  emoji: '🏷️',
  accentColor: 'var(--gold)',
};

async function getDealsByCategory(category: string): Promise<Deal[]> {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;
    const queryCat = category.toLowerCase();
    const deals = await Deal.find({ is_active: true, category: queryCat })
      .sort({ deal_score: -1 })
      .limit(48)
      .lean();
    return JSON.parse(JSON.stringify(deals));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = CATEGORY_CONFIG[slug] || FALLBACK_CONFIG;
  const label = config.label || slug;
  return {
    title: `Best ${label} Deals in India | ShadowMerchant`,
    description: `Discover the highest-discounted ${label} deals from Amazon, Flipkart, and more. AI-ranked by deal quality.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = CATEGORY_CONFIG[slug] || { ...FALLBACK_CONFIG, label: slug };
  const label = config.label || slug;

  const deals = await getDealsByCategory(slug);

  return (
    <main className="flex-1 w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online' },
          { '@type': 'ListItem', position: 2, name: label, item: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online'}/category/${slug}` },
        ]
      })}} />

      {/* Category Hero Banner */}
      <div
        className="w-full relative overflow-hidden"
        style={{ background: config.gradient, borderBottom: `1px solid ${config.accentColor}25` }}
      >
        {/* Glow blob */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-[100px] opacity-20 pointer-events-none"
          style={{ background: config.accentColor }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/deals/feed" className="hover:text-white transition-colors">Deals</Link>
            <span>/</span>
            <span style={{ color: config.accentColor }}>{label}</span>
          </div>

          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: `${config.accentColor}20`, border: `1px solid ${config.accentColor}40` }}
            >
              {config.emoji}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Best <span style={{ color: config.accentColor }}>{label}</span> Deals
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {config.description}
              </p>
            </div>
          </div>

          {/* Deal count badge */}
          <div className="mt-5 flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: `${config.accentColor}18`, color: config.accentColor, border: `1px solid ${config.accentColor}30` }}
            >
              {deals.length > 0 ? `${deals.length} deals found` : 'Sourcing deals…'}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Ranked by AI deal score · Updated 3× daily
            </span>
          </div>
        </div>
      </div>

      {/* Deal Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {deals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {deals.map((deal) => (
              <DealCard key={deal._id} deal={deal} />
            ))}
          </div>
        ) : (
          <div className="w-full py-24 flex flex-col items-center justify-center rounded-2xl border text-center"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
            <div className="text-5xl mb-4" style={{ opacity: 0.4 }}>{config.emoji}</div>
            <h2 className="text-xl font-bold text-white mb-2">No {label} deals yet</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Our scrapers run every 6 hours — check back soon.
            </p>
            <Link
              href="/deals/feed"
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'var(--gold)', color: '#0A0A0A' }}
            >
              Browse All Deals →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

