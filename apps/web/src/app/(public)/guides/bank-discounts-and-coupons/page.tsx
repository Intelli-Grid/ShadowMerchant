import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Bank Card Discounts, Instant Coupons & Exchange Offers Explained | ShadowMerchant',
  description: 'Learn how to calculate real net out-of-pocket costs when e-commerce stores list conditional prices.',
  openGraph: {
    title: 'Bank Card Discounts & Instant Coupons Explained',
    description: 'Calculate real net costs for credit card cashbacks, instant coupons, and exchange offers.',
    url: 'https://www.shadowmerchant.online/guides/bank-discounts-and-coupons',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/guides/bank-discounts-and-coupons' },
};

export default function BankDiscountsGuide() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <Link href="/guides" className="text-xs font-semibold text-gold hover:underline mb-6 inline-block">
        ← Back to all guides
      </Link>

      <article className="prose prose-invert max-w-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold">Buying Strategies</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4 leading-tight">
          Bank Card Discounts, Instant Coupons &amp; Exchange Offers Explained
        </h1>

        <p className="text-sm text-gray-400 mb-8">
          Published by ShadowMerchant Research · 5 min read · Updated August 2026
        </p>

        <p className="text-base text-gray-300 leading-relaxed mb-6">
          Headline sale prices on Indian e-commerce platforms often include optional conditional discounts (e.g. <em>&quot;Effective price ₹44,990 including ₹5,000 HDFC card discount &amp; ₹3,000 exchange bonus&quot;</em>).
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">1. Flat Store Price vs Conditional Offers</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Always separate the <strong>flat checkout price</strong> (payable by any user with any payment method) from <strong>conditional bank offers</strong> (restricted to specific credit cards or EMI plans).
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">2. Exchange Offer Valuation Reality</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Exchange offer bonuses require giving up a working device. Subtracting maximum exchange value from a laptop&apos;s sticker price produces a deceptive effective price unless you actually trade in that specific device.
        </p>
      </article>
    </main>
  );
}
