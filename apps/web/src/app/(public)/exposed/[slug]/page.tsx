import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

// ── Sale event configuration ──────────────────────────────────────────────────
// Keyed by URL slug. Each entry maps to a known Indian e-commerce sale event.
// Platform is used to filter deals from the DB. No sale_event field needed.

const SALE_EVENTS: Record<string, {
  title: string;
  subtitle: string;
  platform: 'amazon' | 'flipkart' | 'myntra' | 'nykaa' | 'meesho' | 'all';
  description: string;
  faqAnswer: string;
  emoji: string;
  accentColor: string;
}> = {
  'amazon-great-indian-festival': {
    title: 'Amazon Great Indian Festival',
    subtitle: 'Is the sale real? We checked 30-day price history.',
    platform: 'amazon',
    description: "Amazon's Great Indian Festival runs annually around October. It's the largest sale event in Indian e-commerce. We track prices 30 days before, during, and after the sale to determine which deals represent genuine discounts and which are inflated MRPs designed to create an illusion of savings.",
    faqAnswer: "Mixed. A subset of deals — typically electronics with competitive pricing — are genuine. The majority of 'sale' prices on fashion and home categories show inflated base MRPs that were artificially raised in the 2–4 weeks before the sale, producing a large-looking percentage discount on a false original price. Shadow Score below 50 is a reliable signal of this pattern.",
    emoji: '🎪',
    accentColor: '#FF9900',
  },
  'flipkart-big-billion-days': {
    title: 'Flipkart Big Billion Days',
    subtitle: 'Biggest sale or biggest illusion? Price history tells the truth.',
    platform: 'flipkart',
    description: "Flipkart's Big Billion Days typically runs in October alongside Amazon's Great Indian Festival. We track 30-day price history for every Flipkart deal in our database to separate genuine discounts from MRP inflation.",
    faqAnswer: "Partially. Flash deals on electronics (Redmi, realme, Samsung mid-range) often reflect genuine market pricing. Fashion and lifestyle categories regularly show MRP inflation — products listed at ₹3,999 'original' that were selling at ₹2,999 three weeks before the sale. Our Shadow Score flags these automatically.",
    emoji: '📅',
    accentColor: '#2874F0',
  },
  'amazon-prime-day': {
    title: 'Amazon Prime Day',
    subtitle: 'Prime exclusive or price theater? Our data answers.',
    platform: 'amazon',
    description: "Amazon Prime Day runs twice a year (typically July and January in India). Prime membership is required to access deals. We audit whether 'Prime exclusive' pricing represents actual savings vs. inflated reference prices.",
    faqAnswer: "Electronics and tech accessories tend to show real discounts on Prime Day — Amazon uses Prime Day to move inventory and the savings are often genuine. Apparel and home decor show the highest rate of MRP inflation. Always check if the 'original price' was actually charged at any point in the last 30 days.",
    emoji: '🎯',
    accentColor: '#00A8CC',
  },
  'myntra-end-of-reason-sale': {
    title: 'Myntra End of Reason Sale (EORS)',
    subtitle: 'Fashion discounts: real or manufactured? We tracked the prices.',
    platform: 'myntra',
    description: "Myntra EORS runs twice a year (June and December) and is India's largest fashion sale. Fashion pricing is notoriously opaque — MRPs can be set at manufacturer's discretion without reference to actual market prices. We track Myntra prices for 30 days before each EORS.",
    faqAnswer: "EORS has the highest rate of MRP inflation of any major Indian sale event in our data. The fashion industry is structurally reliant on high-MRP / high-discount pricing as a conversion tactic — a product 'originally' ₹4,999 that has never sold at that price, discounted to ₹1,299, is not 74% off. Brands and platform MRP standards differ. Look for Shadow Score 65+ for deals where the discount is meaningful relative to actual historical pricing.",
    emoji: '👗',
    accentColor: '#FF3F6C',
  },
  'nykaa-pink-friday': {
    title: 'Nykaa Pink Friday Sale',
    subtitle: 'Beauty deals: which ones are real? 30-day tracking reveals all.',
    platform: 'nykaa',
    description: "Nykaa's Pink Friday Sale runs around November, aligned with global Black Friday. Beauty and personal care products are our most frequently scraped category on Nykaa. We maintain 30-day price history to assess every deal's legitimacy.",
    faqAnswer: "Skincare and makeup from established brands (Lakme, Mamaearth, Dot & Key) often show genuine discounts of 15–30% on Pink Friday — these are real promotions from brand partners. Premium international brands (The Ordinary, Clinique) show almost no genuine discounting during the event. The highest Shadow Scores on Pink Friday tend to be bundle deals, not individual product discounts.",
    emoji: '🛍️',
    accentColor: '#FF6B9D',
  },
};

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getExposedDeals(
  platform: string
): Promise<{ deals: Deal[]; stats: { total: number; shiftedCount: number; avgScore: number } }> {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const DealModel = (await import('@/models/Deal')).default;

    const platformQuery = platform === 'all' ? {} : { source_platform: platform };

    // Pull deals with shifted MRP (confirmed fake discounts) OR low Shadow Score
    const exposedQuery = {
      ...platformQuery,
      is_active: true,
      $or: [
        { mrp_verified: 'shifted' },
        { deal_score: { $lt: 45 } },
      ],
    };

    const [deals, totalActive, shiftedCount] = await Promise.all([
      DealModel.find(exposedQuery)
        .sort({ deal_score: 1 })   // Worst deals first — most "exposed"
        .limit(16)
        .lean(),
      DealModel.countDocuments({ ...platformQuery, is_active: true }),
      DealModel.countDocuments({ ...platformQuery, is_active: true, mrp_verified: 'shifted' }),
    ]);

    // Average Shadow Score across the platform's active deals
    const agg = await DealModel.aggregate([
      { $match: { ...platformQuery, is_active: true } },
      { $group: { _id: null, avg: { $avg: '$deal_score' } } },
    ]);
    const avgScore = Math.round(agg[0]?.avg ?? 0);

    return {
      deals: JSON.parse(JSON.stringify(deals)),
      stats: { total: totalActive, shiftedCount, avgScore },
    };
  } catch (e) {
    console.error('[exposed page] DB error:', e);
    return { deals: [], stats: { total: 0, shiftedCount: 0, avgScore: 0 } };
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = SALE_EVENTS[slug];
  if (!event) return { title: 'Sale Verdict | ShadowMerchant' };

  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online').replace(/\/$/, '');
  return {
    title: `${event.title} — Real or Fake? | ShadowMerchant`,
    description: `Is ${event.title} real? We tracked 30-day price history to expose fake discounts and verify genuine deals. Shadow Score data tells the truth.`,
    alternates: { canonical: `${APP_URL}/exposed/${slug}` },
    openGraph: {
      title: `${event.title} — Verified by Price History`,
      description: `We checked every deal. See which ${event.title} discounts are real vs. inflated MRP.`,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ExposedVerdictPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = SALE_EVENTS[slug];

  if (!event) notFound();

  const { deals, stats } = await getExposedDeals(event.platform);
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online').replace(/\/$/, '');

  // % of deals with confirmed shifted MRP
  const shiftedPct = stats.total > 0
    ? Math.round((stats.shiftedCount / stats.total) * 100)
    : 0;

  // Overall verdict based on average Shadow Score
  const verdict =
    stats.avgScore >= 65 ? { label: 'MOSTLY REAL', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' } :
    stats.avgScore >= 45 ? { label: 'MIXED',        color: '#FCD34D', bg: 'rgba(252,211,77,0.1)' } :
                           { label: 'MOSTLY FAKE',  color: '#F87171', bg: 'rgba(248,113,113,0.1)' };

  // FAQPage JSON-LD — targets featured snippet for "Is [sale] real?" search
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home',    item: APP_URL },
        { '@type': 'ListItem', position: 2, name: 'Exposed', item: `${APP_URL}/exposed` },
        { '@type': 'ListItem', position: 3, name: event.title, item: `${APP_URL}/exposed/${slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `Is ${event.title} real or fake?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: event.faqAnswer,
          },
        },
        {
          '@type': 'Question',
          name: `How does ShadowMerchant verify ${event.title} deals?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'ShadowMerchant tracks 30-day price history for every deal. The Shadow Score (0–100) combines discount authenticity, absolute price drop, rating quality, and freshness. Any deal where the listed MRP is more than 40% above the observed historical maximum is flagged as shifted MRP — meaning the original price was likely inflated before the sale to manufacture a larger-looking discount.',
          },
        },
      ],
    },
  ];

  return (
    <main className="flex-1 w-full">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      {/* ── Hero ── */}
      <div
        className="w-full relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1A0A0A 0%, #2A0F0F 100%)',
          borderBottom: '1px solid rgba(248,113,113,0.15)',
        }}
      >
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-[120px] opacity-15 pointer-events-none"
          style={{ background: event.accentColor }}
        />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span style={{ color: 'rgba(248,113,113,0.8)' }}>Exposed</span>
            <span>/</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{event.title}</span>
          </div>

          {/* Event emoji + title */}
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: `${event.accentColor}18`, border: `1px solid ${event.accentColor}35` }}
            >
              {event.emoji}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#F87171' }}>
                🔍 Sale Verdict
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                {event.title}
              </h1>
              <p className="mt-2 text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {event.subtitle}
              </p>
            </div>
          </div>

          {/* ── Verdict stats strip ── */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Overall verdict */}
            <div
              className="rounded-2xl p-5"
              style={{ background: verdict.bg, border: `1px solid ${verdict.color}30` }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Overall Verdict
              </div>
              <div className="text-2xl font-black" style={{ color: verdict.color }}>
                {verdict.label}
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Based on avg Shadow Score
              </div>
            </div>

            {/* Avg Shadow Score */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Avg Shadow Score
              </div>
              <div className="text-2xl font-black text-white">
                {stats.avgScore}<span className="text-base font-normal opacity-50">/100</span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Across {stats.total.toLocaleString('en-IN')} active deals
              </div>
            </div>

            {/* Shifted MRP % */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Inflated MRP Detected
              </div>
              <div className="text-2xl font-black" style={{ color: '#F87171' }}>
                {shiftedPct}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Of deals have shifted base price
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* What we found */}
        <div className="mb-12">
          <h2 className="text-xl font-black text-white mb-3">About This Sale</h2>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {event.description}
          </p>
        </div>

        {/* FAQ — also the JSON-LD content */}
        <div
          className="rounded-2xl p-6 mb-12"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
        >
          <h2 className="text-lg font-black text-white mb-4">
            Is {event.title} Real or Fake?
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {event.faqAnswer}
          </p>
        </div>

        {/* Exposed deals */}
        {deals.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black text-white mb-2">
              Lowest-Scoring Deals Right Now
            </h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              These deals have confirmed inflated MRP or low Shadow Score — approach with caution.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
              {deals.map((deal) => (
                <DealCard key={deal._id} deal={deal} />
              ))}
            </div>
          </div>
        )}

        {/* How scoring works */}
        <div
          className="rounded-2xl p-6 mb-12"
          style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)' }}
        >
          <h2 className="text-lg font-black text-white mb-3">How We Verify Deals</h2>
          <div className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
            <p>
              <strong className="text-white">30-Day Price History:</strong> We track the actual selling price of every deal for 30 days. If the listed MRP is more than 40% above the highest price we observed in 30 days, we flag it as shifted MRP.
            </p>
            <p>
              <strong className="text-white">Shadow Score (0–100):</strong> A composite score across 5 signals: discount authenticity, absolute price drop, popularity, rating quality, and freshness. Anything below 50 is a weak deal; anything above 80 is genuinely exceptional.
            </p>
            <p>
              <strong className="text-white">No ads. No affiliate-first ranking.</strong> Deals are ranked by quality score, not by commission rate.
            </p>
          </div>
          <Link
            href="/how-scoring-works"
            className="inline-block mt-4 text-sm font-bold underline"
            style={{ color: 'var(--gold)' }}
          >
            Read the full methodology →
          </Link>
        </div>

        {/* CTA */}
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.04) 100%)', border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <div className="text-3xl mb-3">🔔</div>
          <h2 className="text-xl font-black text-white mb-2">
            Never Pay Full Price Again
          </h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Set a target price on any deal and we'll alert you the moment it drops to your price — before the next sale event.
          </p>
          <Link
            href="/pro"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          >
            Get Price Alerts — Free →
          </Link>
        </div>
      </div>
    </main>
  );
}

// Export static params so Next.js pre-renders these pages at build time
export async function generateStaticParams() {
  return Object.keys(SALE_EVENTS).map((slug) => ({ slug }));
}
