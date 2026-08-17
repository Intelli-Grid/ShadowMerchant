import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Buyer Education & Price History Guides | ShadowMerchant',
  description: 'Learn how e-commerce pricing works in India. Transparent, evidence-backed guides on strikethrough MRPs, laptop variant comparisons, and 30-day price tracking.',
  openGraph: {
    title: 'Buyer Education Guides | ShadowMerchant',
    description: 'Independent buyer guides explaining online prices, MRPs, and price tracking in India.',
    url: 'https://www.shadowmerchant.online/guides',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/guides' },
};

const GUIDES = [
  {
    slug: 'strikethrough-mrp-myth',
    title: 'Why Strikethrough Prices Aren\'t Proof of Savings in India',
    description: 'Learn how inflated reference MRPs create optical discount illusion during sale events and how to verify actual historical prices.',
    category: 'E-Commerce Transparency',
    readTime: '4 min read',
  },
  {
    slug: 'laptop-variant-guide',
    title: 'How to Compare Laptop Configurations Without Mixing Variants',
    description: 'Why comparing an RTX 3050 laptop to an RTX 4050 model distorts price perception. Learn exact SKU matching.',
    category: 'Laptop Buyer Guide',
    readTime: '5 min read',
  },
  {
    slug: 'price-tracking-explained',
    title: 'What 7, 14, and 30 Days of Price Tracking Actually Mean',
    description: 'Understanding tracking confidence, snapshot frequencies, and why single-observation deals are not historical evidence.',
    category: 'Methodology',
    readTime: '4 min read',
  },
  {
    slug: 'bank-discounts-and-coupons',
    title: 'Bank Card Discounts, Instant Coupons & Exchange Offers Explained',
    description: 'How to calculate real net out-of-pocket costs when e-commerce stores list conditional prices.',
    category: 'Buying Strategies',
    readTime: '5 min read',
  },
];

export default function GuidesPage() {
  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-10 sm:py-14">
      <div className="text-center mb-12">
        <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
          style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
          📚 Buyer Education & Methodology
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold mt-4 text-white tracking-tight">
          How Online Prices Really Work in India
        </h1>
        <p className="mt-3 text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Independent, evidence-backed guides to help you make informed purchase decisions without relying on retail marketing claims.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="p-6 rounded-2xl border transition-all hover:scale-[1.01] flex flex-col justify-between"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-3">
                <span className="text-gold font-semibold">{g.category}</span>
                <span style={{ color: 'var(--text-muted)' }}>{g.readTime}</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 leading-snug hover:text-gold transition-colors">
                {g.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {g.description}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t flex items-center text-xs font-semibold text-gold" style={{ borderColor: 'var(--sm-border)' }}>
              Read Guide →
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
