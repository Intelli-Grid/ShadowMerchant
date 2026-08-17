import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import consoleData from '@/data/console_reports_data.json';

interface ReportPageProps {
  params: Promise<{ slug: string }>;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const report = consoleData.find((r) => r.slug === slug);
  if (!report) return { title: 'Report Not Found | ShadowMerchant' };

  return {
    title: `${report.title} — Decision Report | ShadowMerchant`,
    description: `Observed price tracking record for ${report.title}. Current price ${formatPrice(report.current_price)} vs 30-day median ${formatPrice(report.observed_median)}. Verdict: ${report.recommendation}.`,
    openGraph: {
      title: `${report.title} — Decision Report`,
      description: `Observed 30-day price tracking and Buy/Wait verdict for ${report.title}.`,
      url: `https://www.shadowmerchant.online/reports/consoles/${slug}`,
    },
    alternates: { canonical: `https://www.shadowmerchant.online/reports/consoles/${slug}` },
  };
}

export async function generateStaticParams() {
  return consoleData.map((r) => ({ slug: r.slug }));
}

export default async function ConsoleReportDetailPage({ params }: ReportPageProps) {
  const { slug } = await params;
  const report = consoleData.find((r) => r.slug === slug);
  if (!report) notFound();

  const isBuy = report.recommendation === 'BUY';

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-10 sm:py-14">
      <Link href="/reports/consoles" className="text-xs font-semibold text-gold hover:underline mb-6 inline-block">
        ← Back to all Gaming Console Decision Reports
      </Link>

      <article className="prose prose-invert max-w-none">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold">
            🎮 Console Decision Report #{report.id}
          </span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded"
            style={{
              background: isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: isBuy ? '#22c55e' : '#F59E0B',
              border: `1px solid ${isBuy ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}
          >
            Verdict: {report.recommendation}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 mb-4 leading-snug">
          {report.title}
        </h1>

        <p className="text-xs text-gray-400 mb-8">
          Platform: <strong>{report.platform} Store</strong> · Tracked: <strong>{report.observation_count} snapshots</strong> ({report.valid_days} valid days) · Checked: August 2026
        </p>

        {/* Verdict Box */}
        <div
          className="p-6 rounded-2xl mb-8 border"
          style={{
            background: isBuy ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
            borderColor: isBuy ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{isBuy ? '💡' : '⏳'}</span>
            <h2 className="text-lg font-bold m-0" style={{ color: isBuy ? '#22c55e' : '#F59E0B' }}>
              Recommendation: {report.recommendation}
            </h2>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed m-0">{report.reasoning}</p>
        </div>

        {/* Pricing Summary Table */}
        <h2 className="text-xl font-bold text-white mt-8 mb-4">📊 Observed Price Tracking Data</h2>
        <div className="overflow-x-auto rounded-xl border mb-8" style={{ borderColor: 'var(--sm-border)' }}>
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-white/5 text-gold border-b" style={{ borderColor: 'var(--sm-border)' }}>
              <tr>
                <th className="px-4 py-3">Tracking Metric</th>
                <th className="px-4 py-3">Observed Value</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--sm-border)' }}>
              <tr>
                <td className="px-4 py-3 font-semibold text-white">Current Observed Price</td>
                <td className="px-4 py-3 font-extrabold text-gold text-base">{formatPrice(report.current_price)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Strikethrough Reference MRP</td>
                <td className="px-4 py-3 line-through text-gray-400">{formatPrice(report.original_price)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Observed 30-Day Median Price</td>
                <td className="px-4 py-3 font-semibold text-white">{formatPrice(report.observed_median)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Observed 30-Day Range</td>
                <td className="px-4 py-3">{formatPrice(report.observed_min)} – {formatPrice(report.observed_max)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Tracking History Evidence</td>
                <td className="px-4 py-3">{report.observation_count} snapshots across {report.valid_days} days</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Merchant CTA Button */}
        <div className="my-8 text-center sm:text-left">
          <a
            href={report.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          >
            Check Live Availability on {report.platform} →
          </a>
        </div>

        {/* Disclosures */}
        <div className="mt-12 pt-6 border-t text-xs text-gray-400 space-y-3" style={{ borderColor: 'var(--sm-border)' }}>
          <p>
            <strong>Affiliate Disclosure:</strong> ShadowMerchant participates in affiliate programs. We may earn a small commission if you purchase through our links, at no extra cost to you.
          </p>
          <p>
            <strong>Merchant Price Disclaimer:</strong> Product prices and availability are accurate as of the date/time indicated and are subject to change on the merchant platform at checkout.
          </p>
        </div>
      </article>
    </main>
  );
}
