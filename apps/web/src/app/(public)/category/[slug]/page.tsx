import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  electronics: 'Electronics',
  fashion: 'Fashion',
  beauty: 'Beauty & Personal Care',
  home: 'Home & Kitchen',
  sports: 'Sports & Outdoors',
  books: 'Books',
  toys: 'Toys & Games',
  grocery: 'Grocery & Food',
};

async function getDealsByCategory(category: string): Promise<Deal[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/deals?category=${category}&sort=score&limit=24`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.deals || [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = CATEGORY_LABELS[slug] || slug;
  return {
    title: `Best ${label} Deals in India | ShadowMerchant`,
    description: `Discover the highest-discounted ${label} deals from Amazon, Flipkart, and more. AI-ranked by deal quality.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = CATEGORY_LABELS[slug] || slug;
  const deals = await getDealsByCategory(slug);

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
          <span>Home</span> <span>/</span> <span className="text-white">{label}</span>
        </div>
        <h1 className="text-3xl font-black text-white">
          Best <span className="text-[#FF6B00]">{label}</span> Deals
        </h1>
        <p className="text-gray-500 mt-2">{deals.length} deals found, ranked by AI deal score</p>
      </div>

      {deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} />
          ))}
        </div>
      ) : (
        <div className="w-full py-20 flex flex-col items-center justify-center bg-[#13131A] rounded-xl border border-[#2A2A35] text-center">
          <span className="text-4xl mb-4">🔍</span>
          <h2 className="text-xl font-bold text-white mb-2">No deals in {label} yet</h2>
          <p className="text-gray-500">Check back soon — our scrapers run every 6 hours.</p>
        </div>
      )}
    </main>
  );
}
