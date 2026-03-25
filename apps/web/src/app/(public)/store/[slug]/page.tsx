import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

const STORE_META: Record<string, { label: string; color: string; tagline: string }> = {
  amazon:   { label: 'Amazon India',  color: '#FF9900', tagline: 'Best deals across Amazon India' },
  flipkart: { label: 'Flipkart',      color: '#2874F0', tagline: "Flipkart's biggest discounts" },
  myntra:   { label: 'Myntra',        color: '#FF3F6C', tagline: 'Fashion deals from Myntra' },
  meesho:   { label: 'Meesho',        color: '#F43397', tagline: "Meesho's lowest prices" },
  nykaa:    { label: 'Nykaa',         color: '#FC2779', tagline: 'Beauty deals from Nykaa' },
  croma:    { label: 'Croma',         color: '#00E9BF', tagline: 'Electronics from Croma' },
};

async function getDealsByPlatform(platform: string): Promise<Deal[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/deals?platform=${platform}&sort=score&limit=24`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.deals || [];
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const meta = STORE_META[params.slug];
  const label = meta?.label || params.slug;
  return {
    title: `${label} Deals Today | ShadowMerchant`,
    description: `${meta?.tagline || `Best ${label} deals`}. AI-ranked and updated every 6 hours.`,
  };
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const meta = STORE_META[params.slug] || { label: params.slug, color: '#FF6B00', tagline: '' };
  const deals = await getDealsByPlatform(params.slug);

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Store Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm"
          style={{ backgroundColor: meta.color }}>
          {meta.label[0]}
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">{meta.label} Deals</h1>
          <p className="text-gray-500 mt-1">{deals.length} deals found today</p>
        </div>
      </div>

      {deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} />
          ))}
        </div>
      ) : (
        <div className="w-full py-20 flex flex-col items-center justify-center bg-[#13131A] rounded-xl border border-[#2A2A35] text-center">
          <span className="text-4xl mb-4">🛍️</span>
          <h2 className="text-xl font-bold text-white mb-2">No {meta.label} deals yet</h2>
          <p className="text-gray-500">Our scrapers run every 6 hours — check back soon.</p>
        </div>
      )}
    </main>
  );
}
