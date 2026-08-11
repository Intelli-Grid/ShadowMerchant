import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'All Deal Categories | ShadowMerchant',
  description:
    'Browse deals by category — Electronics, Fashion, Beauty, Home & more. Every deal cross-checked against 30-day price history. No fake sales.',
  openGraph: {
    title: 'All Deal Categories | ShadowMerchant',
    description: 'Browse deals by category across Amazon, Flipkart, Myntra & more.',
    type: 'website',
  },
};

const CATEGORIES = [
  {
    slug: 'electronics',
    label: 'Electronics',
    description: 'Phones, laptops, audio & gadgets',
    emoji: '💻',
    accentColor: '#60A5FA',
    gradient: 'linear-gradient(135deg, #0D1E3D 0%, #0F2552 100%)',
  },
  {
    slug: 'fashion',
    label: 'Fashion',
    description: 'Clothes, footwear & accessories',
    emoji: '👗',
    accentColor: '#F472B6',
    gradient: 'linear-gradient(135deg, #2D0A1F 0%, #4A0E2E 100%)',
  },
  {
    slug: 'beauty',
    label: 'Beauty & Personal Care',
    description: 'Skincare, makeup & wellness',
    emoji: '💄',
    accentColor: '#C084FC',
    gradient: 'linear-gradient(135deg, #1E0A3C 0%, #2D0F5A 100%)',
  },
  {
    slug: 'home',
    label: 'Home & Kitchen',
    description: 'Appliances, cookware & décor',
    emoji: '🏠',
    accentColor: '#34D399',
    gradient: 'linear-gradient(135deg, #0A2018 0%, #0F3526 100%)',
  },
  {
    slug: 'sports',
    label: 'Sports & Outdoors',
    description: 'Fitness gear & sports equipment',
    emoji: '🏋️',
    accentColor: '#FCD34D',
    gradient: 'linear-gradient(135deg, #1A1A0A 0%, #2E2E0F 100%)',
  },
  {
    slug: 'books',
    label: 'Books',
    description: 'Fiction, textbooks & more',
    emoji: '📚',
    accentColor: '#94A3B8',
    gradient: 'linear-gradient(135deg, #0F1A2A 0%, #162438 100%)',
  },
  {
    slug: 'toys',
    label: 'Toys & Games',
    description: 'Kids toys & board games',
    emoji: '🧸',
    accentColor: '#FB923C',
    gradient: 'linear-gradient(135deg, #2A0A0A 0%, #3D0F0F 100%)',
  },
  {
    slug: 'health',
    label: 'Health & Nutrition',
    description: 'Supplements & health essentials',
    emoji: '💊',
    accentColor: '#4ADE80',
    gradient: 'linear-gradient(135deg, #0A2A1A 0%, #0F3D25 100%)',
  },
  {
    slug: 'automotive',
    label: 'Automotive',
    description: 'Car accessories & tools',
    emoji: '🚗',
    accentColor: '#A78BFA',
    gradient: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
  },
  {
    slug: 'grocery',
    label: 'Grocery & Staples',
    description: 'Pantry essentials & packaged food',
    emoji: '🛒',
    accentColor: '#86EFAC',
    gradient: 'linear-gradient(135deg, #1A2A0A 0%, #263D0F 100%)',
  },
  {
    slug: 'travel',
    label: 'Travel & Luggage',
    description: 'Bags, luggage & travel gear',
    emoji: '✈️',
    accentColor: '#7DD3FC',
    gradient: 'linear-gradient(135deg, #0A1A2A 0%, #0F263D 100%)',
  },
  {
    slug: 'gaming',
    label: 'Gaming',
    description: 'Consoles, games & peripherals',
    emoji: '🎮',
    accentColor: '#F0ABFC',
    gradient: 'linear-gradient(135deg, #1A0A2A 0%, #2A0F3D 100%)',
  },
];

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online';

export default function CategoriesPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ShadowMerchant Deal Categories',
    description: 'Browse deals by category — verified against 30-day price history.',
    numberOfItems: CATEGORIES.length,
    itemListElement: CATEGORIES.map((cat, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: cat.label,
      url: `${BASE_URL}/category/${cat.slug}`,
    })),
  };

  return (
    <main className="flex-1 w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Page Hero */}
      <div
        className="w-full relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 100%)',
          borderBottom: '1px solid rgba(212,175,55,0.15)',
        }}
      >
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] opacity-10 pointer-events-none"
          style={{ background: 'var(--gold)' }}
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 text-xs mb-5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--gold)' }}>Categories</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Browse by{' '}
            <span style={{ color: 'var(--gold)' }}>Category</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Every deal cross-checked against 30-day price history. No fake sales.
          </p>
        </div>
      </div>

      {/* Category Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
              style={{
                background: cat.gradient,
                borderColor: `${cat.accentColor}25`,
              }}
            >
              {/* Glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                style={{ background: cat.accentColor }}
                aria-hidden="true"
              />

              <div className="relative z-10 p-5">
                {/* Emoji icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `${cat.accentColor}18`,
                    border: `1px solid ${cat.accentColor}35`,
                  }}
                >
                  {cat.emoji}
                </div>

                <h2
                  className="font-bold text-white text-sm leading-tight mb-1"
                  style={{ fontSize: '0.9rem' }}
                >
                  {cat.label}
                </h2>
                <p
                  className="text-xs leading-snug"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {cat.description}
                </p>

                {/* Arrow */}
                <div
                  className="mt-3 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ color: cat.accentColor }}
                >
                  View deals <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
