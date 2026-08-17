import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'What 7, 14, and 30 Days of Price Tracking Actually Mean | ShadowMerchant',
  description: 'Understand how price history confidence levels, snapshot intervals, and observation counts work.',
  openGraph: {
    title: 'What 7, 14, and 30 Days of Price Tracking Actually Mean',
    description: 'Learn why single-observation deals are not historical evidence and how ShadowMerchant ranks confidence.',
    url: 'https://www.shadowmerchant.online/guides/price-tracking-explained',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/guides/price-tracking-explained' },
};

export default function PriceTrackingExplainedGuide() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <Link href="/guides" className="text-xs font-semibold text-gold hover:underline mb-6 inline-block">
        ← Back to all guides
      </Link>

      <article className="prose prose-invert max-w-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold">Methodology</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4 leading-tight">
          What 7, 14, and 30 Days of Price Tracking Actually Mean
        </h1>

        <p className="text-sm text-gray-400 mb-8">
          Published by ShadowMerchant Research · 4 min read · Updated August 2026
        </p>

        <p className="text-base text-gray-300 leading-relaxed mb-6">
          When automated deal aggregators claim a product is at an &quot;all-time low&quot; based on a single price check, they risk misleading buyers. A single data point records current price — not price history.
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">1. Observation Count vs Valid Tracking Days</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          ShadowMerchant distinguishes between <strong>observation count</strong> (total scraper price checks) and <strong>valid tracking days</strong> (unique calendar days with recorded price snapshots).
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">2. The Three Tracking Badges</h2>
        <ul className="list-disc pl-5 text-sm text-gray-300 space-y-2 mb-4">
          <li><strong>New Tracking (&lt;7 days):</strong> Product recently added to tracker. Price trends are preliminary.</li>
          <li><strong>Tracked Record (7–29 days):</strong> Moderate evidence history. Median price is established.</li>
          <li><strong>30-Day Range (30+ days):</strong> Full statistical confidence. Historical minimum and maximum prices are verified.</li>
        </ul>
      </article>
    </main>
  );
}
