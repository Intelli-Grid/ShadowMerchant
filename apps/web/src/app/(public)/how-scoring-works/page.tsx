import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How Scoring Works | ShadowMerchant',
  description:
    'Understand exactly how ShadowMerchant calculates its Shadow Score — a transparent, commission-independent algorithm that ranks deals on real savings, not platform payouts.',
  alternates: { canonical: '/how-scoring-works' },
};

/**
 * These weights are derived directly from deal_scorer.py v2.1 (scripts/processors/deal_scorer.py).
 * Do not edit the descriptions here without also verifying against the Python scorer source.
 */
const SCORE_COMPONENTS = [
  {
    weight: '35%',
    label: 'Discount Percentage',
    icon: '📉',
    description:
      'The percentage off the listed MRP, normalized against a 70% ceiling. A 70%+ discount scores the maximum on this component. This is the single largest factor — deep discounts are rewarded most.',
  },
  {
    weight: '20%',
    label: 'Absolute Price Drop (₹)',
    icon: '💰',
    description:
      'The raw rupee amount you save, normalized against ₹3,000. A deal saving ₹3,000 or more scores the maximum on this component. This rewards large-ticket deals where the absolute saving matters, even when the percentage is moderate.',
  },
  {
    weight: '20%',
    label: 'Popularity (Review Count)',
    icon: '⭐',
    description:
      'The number of customer reviews, normalized against 10,000. A product with 10,000+ reviews scores the maximum. Products with no review count available (common on Myntra, Nykaa, Meesho which do not expose this data) receive a neutral 0.3 score rather than being unfairly penalised.',
  },
  {
    weight: '15%',
    label: 'Product Rating',
    icon: '🏅',
    description:
      'The star rating out of 5.0. A perfect 5-star product scores the maximum. Products with no rating data available receive a neutral 0.3 score rather than being penalised for missing platform data.',
  },
  {
    weight: '10%',
    label: 'Freshness',
    icon: '⏱️',
    description:
      'Deals decay linearly over 7 days (168 hours). A deal scraped right now scores 1.0 on this component; a 7-day-old deal scores 0. This prevents stale inventory from dominating the feed.',
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
            Every deal on ShadowMerchant has a Deal Ranking Score from 0–100. Here is exactly how it&apos;s calculated — and why commission rates have nothing to do with it.
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
            🛡️ Our Conflict of Interest & Evidence Limits Disclosed Upfront
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            ShadowMerchant earns a small affiliate commission when you buy through our links. This is how we keep the service free.
          </p>
          <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
            <strong className="text-white">Commission rates are not an input to our scoring formula.</strong> The score is calculated from observed price history, discount depth, and product ratings — data that exists before any commission relationship is considered.
          </p>
          <p className="text-sm leading-relaxed mt-2 text-amber-300/90 font-medium">
            ⚠️ <strong>Evidence Limitation:</strong> A high ranking score indicates a favorable relative price drop and product rating based on observed scraper data; it does not constitute legal proof of original manufacturer MRP or merchant pricing intent.
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

        {/* Normalization and penalties note */}
        <div
          className="rounded-2xl p-5 border mb-6"
          style={{ background: 'rgba(99,102,241,0.07)', borderColor: 'rgba(99,102,241,0.2)' }}
        >
          <p className="text-sm font-bold text-indigo-400 mb-1.5">
            📊 Scoring Adjustments
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The five components are combined in a weighted sum, then passed through a sigmoid
            normalization. This means the displayed 0–100 score does not change linearly with
            the underlying weighted sum — it becomes progressively harder to reach very high
            scores, making 95+ rare even for strong deals.
          </p>
          <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
            Two additional penalties can reduce a score <strong className="text-white">before</strong> normalization:
          </p>
          <ul className="text-sm mt-2 space-y-1 list-disc list-inside" style={{ color: 'var(--text-secondary)' }}>
            <li><strong className="text-white">Price above 7-day average:</strong> If the current price is higher than the 7-day observed average, up to −20 points is deducted proportionally.</li>
            <li><strong className="text-white">Suspicious discount:</strong> Discounts ≥80% or prices below 1/5th of the original trigger a trust penalty (heavy deduction), because such extreme discounts are typically signs of inflated MRP.</li>
          </ul>
        </div>

        <div
          className="rounded-2xl p-5 border"
          style={{
            background: 'rgba(201,168,76,0.05)',
            borderColor: 'var(--gold-border)',
          }}
        >
          <p className="text-sm font-bold mb-1.5" style={{ color: 'var(--gold)' }}>
            🌐 Currently Active Platforms
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Products from <strong className="text-white">Amazon, Myntra, and Nykaa</strong> are
            scored using the same formula. No platform receives preferential treatment in scoring.
            Platforms that do not expose review counts or ratings receive neutral scores on those
            components rather than being penalised for missing data.
          </p>
        </div>

      </div>
    </main>
  );
}
