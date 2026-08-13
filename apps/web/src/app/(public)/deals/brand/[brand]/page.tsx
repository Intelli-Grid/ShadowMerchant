import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Capitalise the first letter of each word. */
function toTitleCase(str: string): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getDealsByBrand(brand: string): Promise<{ deals: Deal[]; total: number }> {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;

    // Case-insensitive, exact brand match (not substring) to avoid false positives
    // e.g. "boat" should not match "lifeboat"
    const regex = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const query  = { brand: regex, is_active: true };

    const [deals, total] = await Promise.all([
      DealModel.find(query)
        .sort({ deal_score: -1 })
        .limit(48)
        .lean(),
      DealModel.countDocuments(query),
    ]);

    return { deals: JSON.parse(JSON.stringify(deals)), total };
  } catch (e) {
    console.error('[brand page] DB error:', e);
    return { deals: [], total: 0 };
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const label = toTitleCase(brand);
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online').replace(/\/$/, '');
  return {
    title: `Best ${label} Deals in India — Verified | ShadowMerchant`,
    description: `All active ${label} deals from Amazon, Flipkart & more — ranked by Shadow Score. See which discounts are real vs inflated before you buy.`,
    alternates: { canonical: `${APP_URL}/deals/brand/${brand}` },
    openGraph: {
      title: `${label} Deals — Real Discounts Only | ShadowMerchant`,
      description: `Verified ${label} deals ranked by AI deal score. Shadow Score exposes inflated MRP.`,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BrandDealsPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const label   = toTitleCase(brand);
  const { deals, total } = await getDealsByBrand(brand);

  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online').replace(/\/$/, '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: APP_URL },
      { '@type': 'ListItem', position: 2, name: 'Deals', item: `${APP_URL}/deals` },
      { '@type': 'ListItem', position: 3, name: label,   item: `${APP_URL}/deals/brand/${brand}` },
    ],
  };

  return (
    <main className="flex-1 w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero Banner ── */}
      <div
        className="w-full relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0D1117 0%, #161B22 100%)',
          borderBottom: '1px solid rgba(212,175,55,0.15)',
        }}
      >
        {/* Atmospheric glow */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-[120px] opacity-10 pointer-events-none"
          style={{ background: 'var(--gold)' }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 text-xs mb-5"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/deals/feed" className="hover:text-white transition-colors">Deals</Link>
            <span>/</span>
            <span style={{ color: 'var(--gold)' }}>{label}</span>
          </div>

          <div className="flex items-center gap-5">
            {/* Brand initial avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.25)',
                color: 'var(--gold)',
              }}
            >
              {label.charAt(0).toUpperCase()}
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Best <span style={{ color: 'var(--gold)' }}>{label}</span> Deals
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                All active {label} deals from Amazon, Flipkart &amp; more — ranked by Shadow Score.
                Inflated MRP &amp; fake discounts flagged automatically.
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(212,175,55,0.12)',
                color: 'var(--gold)',
                border: '1px solid rgba(212,175,55,0.25)',
              }}
            >
              {total > 0 ? `${total} deal${total !== 1 ? 's' : ''} found` : 'Sourcing deals…'}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Ranked by AI deal score · Updated 3× daily
            </span>
          </div>
        </div>
      </div>

      {/* ── Deal Grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {deals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {deals.map((deal) => (
              <DealCard key={deal._id} deal={deal} />
            ))}
          </div>
        ) : (
          <div
            className="w-full py-24 flex flex-col items-center justify-center rounded-2xl border text-center"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
          >
            <div className="text-5xl mb-4 font-black" style={{ opacity: 0.3, color: 'var(--gold)' }}>
              {label.charAt(0)}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              No {label} deals right now
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Our scrapers run every 6 hours — check back soon, or browse all deals.
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
