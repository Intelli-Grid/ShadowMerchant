import type { Metadata } from 'next';
import Link from 'next/link';
import applianceData from '@/data/appliance_reports_data.json';

export const metadata: Metadata = {
  title: 'Home Appliances Decision Reports (2026) | ShadowMerchant',
  description: 'Evidence-backed home appliance buying decision reports in India. Observed 30-day median prices, exact model matching, and honest Buy/Wait recommendations.',
  openGraph: {
    title: 'Home Appliances Decision Reports | ShadowMerchant',
    description: 'Independent home appliance decision reports backed by observed daily price tracking.',
    url: 'https://www.shadowmerchant.online/reports/appliances',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/reports/appliances' },
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

export default function ApplianceReportsIndexPage() {
  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 sm:py-14">
      <div className="text-center mb-12">
        <span
          className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
          style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}
        >
          🏠 Vertical Expansion — Home & Kitchen Appliances
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold mt-4 text-white tracking-tight">
          Home Appliances Buying Decision Reports
        </h1>
        <p className="mt-3 text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Exact-model price tracking records. Each report evaluates current store price against observed 30-day medians to give an honest Buy or Wait verdict.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {applianceData.map((appliance) => {
          const isBuy = appliance.recommendation === 'BUY';
          return (
            <Link
              key={appliance.slug}
              href={`/reports/appliances/${appliance.slug}`}
              className="p-6 rounded-2xl border transition-all hover:scale-[1.01] flex flex-col justify-between"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-medium mb-3">
                  <span className="text-gold font-semibold">{appliance.platform} Store</span>
                  <span
                    className="font-bold px-2 py-0.5 rounded text-[11px]"
                    style={{
                      background: isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: isBuy ? '#22c55e' : '#F59E0B',
                      border: `1px solid ${isBuy ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}
                  >
                    Verdict: {appliance.recommendation}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mb-3 leading-snug hover:text-gold transition-colors line-clamp-2">
                  {appliance.title}
                </h2>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl text-xs mb-4" style={{ background: 'var(--bg-raised)' }}>
                  <div>
                    <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>Observed Price</span>
                    <span className="font-extrabold text-white text-sm">{formatPrice(appliance.current_price)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>30-Day Median</span>
                    <span className="font-bold text-gray-300 text-sm">{formatPrice(appliance.observed_median)}</span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {appliance.reasoning}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t flex items-center justify-between text-xs font-semibold text-gold" style={{ borderColor: 'var(--sm-border)' }}>
                <span>View Full Decision Report →</span>
                <span className="text-[10px] text-gray-400 font-normal">{appliance.observation_count} snapshots tracked</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
