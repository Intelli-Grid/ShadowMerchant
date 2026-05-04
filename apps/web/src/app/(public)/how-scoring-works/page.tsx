import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How Scoring Works | ShadowMerchant',
  description:
    'Understand exactly how ShadowMerchant calculates its Shadow Score — a transparent, commission-independent algorithm that ranks deals on real savings, not platform payouts.',
  alternates: { canonical: '/how-scoring-works' },
};

const SCORE_COMPONENTS = [
  {
    weight: '30%',
    label: 'Absolute Savings (₹)',
    icon: '💰',
    description:
      'The raw rupee amount you save. A ₹3,000 saving on a ₹5,000 phone matters more than the same percentage off a ₹100 item. Capped at ₹10,000 to prevent outliers from dominating.',
  },
  {
    weight: '20%',
    label: 'Discount Percentage',
    icon: '📉',
    description:
      'The percentage off the original MRP. Weighted alongside absolute savings so both cheap-but-deep-discounted items and expensive-with-moderate-discount items can rank well.',
  },
  {
    weight: '20%',
    label: 'Price Tier',
    icon: '🏷️',
    description:
      'Higher-ticket items (₹15,000+) receive a higher tier score because the absolute financial decision is more significant. A 20% off ₹20,000 laptop deserves more visibility than 20% off a ₹300 accessory.',
  },
  {
    weight: '20%',
    label: 'AI Deal Score',
    icon: '🤖',
    description:
      '30-day price history analysis. We track the actual selling price of each product over the past month. If today\'s price is genuinely below the 30-day average, this component scores high. If the platform inflated the MRP before discounting, this score stays low.',
  },
  {
    weight: '5%',
    label: 'Social Proof',
    icon: '⭐',
    description:
      'Product rating × log of review count. A 4.5-star product with 10,000 reviews scores higher than a 4.8-star product with 12 reviews. We trust volume alongside quality.',
  },
  {
    weight: '5%',
    label: 'Freshness',
    icon: '⏱️',
    description:
      'Deals decay over 36 hours. A deal scraped 1 hour ago scores higher than the same deal scraped 30 hours ago, all else being equal. This prevents stale inventory from cluttering the top.',
  },
];

export default function HowScoringWorksPage() {
  return (
    <main className="flex-1 w-full">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">

        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-xs font-semibold mb-6 inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Back to deals
          </Link>
          <h1
            className="text-3xl sm:text-4xl font-black mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'white' }}
          >
            How the Shadow Score Works
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Every deal on ShadowMerchant has a score from 0–100. Here is exactly how it&apos;s calculated — and why commission rates have nothing to do with it.
          </p>
        </div>

        {/* Conflict of interest disclosure — prominent, not buried */}
        <div
          className="rounded-2xl p-5 mb-10 border"
          style={{
            background: 'rgba(59,130,246,0.07)',
            borderColor: 'rgba(59,130,246,0.2)',
          }}
        >
          <p className="text-sm font-bold text-blue-400 mb-1.5">
            🛡️ Our Conflict of Interest, Disclosed Upfront
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            ShadowMerchant earns a small affiliate commission when you buy through our links. This is how we keep the service free.
          </p>
          <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
            <strong className="text-white">Commission rates are not an input to our scoring formula.</strong> The score is calculated from price history, discount depth, and product ratings — data that exists before any commission relationship is considered. A product with a higher commission rate does not score higher. A product with zero commission can score 100/100.
          </p>
        </div>

        {/* Score formula breakdown */}
        <h2
          className="text-xl font-black mb-6"
          style={{ fontFamily: 'var(--font-display)', color: 'white' }}
        >
          The Formula
        </h2>
        <div className="flex flex-col gap-4 mb-12">
          {SCORE_COMPONENTS.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl p-5 border flex gap-4 items-start"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
            >
              <div className="text-2xl shrink-0 mt-0.5">{c.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-xs font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }}
                  >
                    {c.weight}
                  </span>
                  <span className="text-sm font-bold text-white">{c.label}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {c.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Score labels */}
        <h2
          className="text-xl font-black mb-6"
          style={{ fontFamily: 'var(--font-display)', color: 'white' }}
        >
          What the Score Means
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {[
            { range: '80–100', label: '🏆 Great Value', color: 'var(--score-high)' },
            { range: '60–79', label: '👍 Good Deal', color: '#818CF8' },
            { range: '40–59', label: '🆗 Fair Deal', color: '#F59E0B' },
            { range: '0–39', label: '😐 Low Score', color: 'var(--text-muted)' },
          ].map((s) => (
            <div
              key={s.range}
              className="rounded-xl p-4 border text-center"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
            >
              <p className="text-xs font-bold mb-1" style={{ color: s.color }}>{s.label}</p>
              <p className="text-lg font-black" style={{ color: 'white' }}>{s.range}</p>
            </div>
          ))}
        </div>

        {/* Platform fairness note */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            background: 'rgba(201,168,76,0.05)',
            borderColor: 'var(--gold-border)',
          }}
        >
          <p className="text-sm font-bold mb-1.5" style={{ color: 'var(--gold)' }}>
            🌐 Platform Fairness
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Products from Amazon, Flipkart, Myntra, Meesho, and Nykaa are scored using the same formula. No platform receives preferential treatment. Platforms with historically inflated MRP (like Meesho) have a platform-aware MRP cap applied before scoring, so a 75% discount on a 2.5× inflated MRP is treated honestly.
          </p>
        </div>

      </div>
    </main>
  );
}
