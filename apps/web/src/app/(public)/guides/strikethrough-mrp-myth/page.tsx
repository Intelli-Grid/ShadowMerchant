import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Why Strikethrough Prices Aren\'t Proof of Savings in India | ShadowMerchant',
  description: 'Understand how crossed-out reference MRPs work on e-commerce platforms in India and how to track true price history.',
  openGraph: {
    title: 'Why Strikethrough Prices Aren\'t Proof of Savings',
    description: 'Learn why original MRP list prices create optical discount illusion and how to verify real savings.',
    url: 'https://www.shadowmerchant.online/guides/strikethrough-mrp-myth',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/guides/strikethrough-mrp-myth' },
};

export default function StrikethroughGuide() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <Link href="/guides" className="text-xs font-semibold text-gold hover:underline mb-6 inline-block">
        ← Back to all guides
      </Link>

      <article className="prose prose-invert max-w-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold">E-Commerce Transparency</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4 leading-tight">
          Why Strikethrough Prices Aren&apos;t Proof of Savings in India
        </h1>

        <p className="text-sm text-gray-400 mb-8">
          Published by ShadowMerchant Research · 4 min read · Updated August 2026
        </p>

        <p className="text-base text-gray-300 leading-relaxed mb-6">
          When shopping online on Amazon, Flipkart, or Myntra, one of the most prominent visual anchors is the strikethrough price — a crossed-out reference price next to a bright red percentage discount (e.g. <span className="line-through">₹12,999</span> <strong>₹2,499 (80% off)</strong>).
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">1. What Maximum Retail Price (MRP) Actually Means</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          In India, the Maximum Retail Price (MRP) is the legal upper limit at which a product can be sold. Manufacturers often set the official MRP high to allow flexibility across distribution channels, retail stores, and regional logistics. However, in online e-commerce, products are rarely sold at their maximum MRP.
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">2. The Optical Discount Illusion</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          If a product has an MRP of ₹10,000, but has been sold at ₹3,500 every single day for the past six months, listing it at ₹3,200 during a festival sale is a <strong>₹300 real price drop</strong> — not a ₹6,800 discount. Calculating savings from the original MRP creates an optical illusion of massive savings where little exists.
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">3. How ShadowMerchant Tracks Price Truth</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Instead of evaluating deals based on the merchant&apos;s strikethrough MRP, ShadowMerchant logs daily price observations over time. Our <strong>Deal Ranking Score</strong> evaluates today&apos;s price against the product&apos;s observed 30-day rolling median price.
        </p>

        <div className="p-4 rounded-xl my-6 border bg-surface" style={{ borderColor: 'var(--sm-border)' }}>
          <p className="text-xs text-gold font-semibold mb-1">💡 Key Takeaway for Smart Buyers</p>
          <p className="text-xs text-gray-300 leading-normal">
            Never judge a deal by its discount percentage. Always check the 30-day observed price range and median price before purchasing.
          </p>
        </div>
      </article>
    </main>
  );
}
