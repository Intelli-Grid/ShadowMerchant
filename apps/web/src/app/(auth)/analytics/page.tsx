'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, MousePointerClick, Package, Star, ExternalLink, BarChart2, Award } from 'lucide-react';

interface AnalyticsData {
  overview: { total_deals: number; active_deals: number; total_clicks: number };
  top_clicked: Array<{ title: string; source_platform: string; click_count: number; deal_score: number; discount_percent: number; discounted_price: number }>;
  platform_breakdown: Array<{ _id: string; clicks: number; count: number }>;
  category_breakdown: Array<{ _id: string; clicks: number; count: number }>;
  daily_trend: Array<{ _id: string; deals_added: number; clicks: number }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  amazon: '#FF9900', flipkart: '#2874F0', myntra: '#FF3F6C',
  meesho: '#9B2D8E', nykaa: '#FC2779', default: '#C9A84C',
};

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
        <Icon className="w-5 h-5" style={{ color: 'var(--gold)' }} />
      </div>
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{value.toLocaleString()}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/analytics', {
      headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '' },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load analytics'); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--gold)' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error || !data) return (
    <div className="flex-1 flex items-center justify-center">
      <p style={{ color: 'var(--text-muted)' }}>{error || 'No data available'}</p>
    </div>
  );

  const maxClicks = Math.max(...(data.platform_breakdown.map(p => p.clicks) || [1]), 1);

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
          <BarChart2 className="w-8 h-8" style={{ color: 'var(--gold)' }} />
          Analytics Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Real-time performance from MongoDB click tracking</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={MousePointerClick} label="Total Deal Clicks" value={data.overview.total_clicks} sub="Lifetime affiliate redirects" />
        <StatCard icon={Package} label="Active Deals" value={data.overview.active_deals} sub={`of ${data.overview.total_deals} total`} />
        <StatCard icon={TrendingUp} label="Avg Clicks/Deal" value={data.overview.active_deals > 0 ? (data.overview.total_clicks / data.overview.active_deals).toFixed(1) : '0'} sub="Active deals only" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Platform Breakdown */}
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
          <h2 className="text-white font-bold mb-5 flex items-center gap-2">
            <Star className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Clicks by Platform
          </h2>
          <div className="space-y-4">
            {data.platform_breakdown.map(p => {
              const color = PLATFORM_COLORS[p._id] ?? PLATFORM_COLORS.default;
              const pct = Math.round((p.clicks / maxClicks) * 100);
              return (
                <div key={p._id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold capitalize text-white">{p._id}</span>
                    <span className="text-xs font-bold" style={{ color }}>{p.clicks.toLocaleString()} clicks</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{p.count} deals listed</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
          <h2 className="text-white font-bold mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Clicks by Category
          </h2>
          <div className="space-y-3">
            {data.category_breakdown.map((c, i) => (
              <div key={c._id} className="flex items-center gap-3">
                <span className="text-xs font-bold w-4" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                <span className="flex-1 text-sm font-semibold capitalize text-white">{c._id || 'uncategorised'}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  {c.clicks} clicks
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.count} deals</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 Clicked Deals */}
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
        <h2 className="text-white font-bold mb-5 flex items-center gap-2">
          <Award className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Top Clicked Deals
        </h2>
        {data.top_clicked.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No clicks recorded yet. Share some deals!</p>
        ) : (
          <div className="space-y-3">
            {data.top_clicked.map((deal, i) => {
              const color = PLATFORM_COLORS[deal.source_platform] ?? PLATFORM_COLORS.default;
              return (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}>
                  <span className="text-lg font-black w-8 text-center" style={{ color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted)' }}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{deal.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize" style={{ background: color + '22', color }}>{deal.source_platform}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>₹{deal.discounted_price?.toLocaleString('en-IN')} · {Math.round(deal.discount_percent)}% OFF · Score {deal.deal_score}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <MousePointerClick className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
                    <span className="text-sm font-black" style={{ color: 'var(--gold)' }}>{deal.click_count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7-day Trend */}
      {data.daily_trend.length > 0 && (
        <div className="rounded-xl p-6 mt-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
          <h2 className="text-white font-bold mb-5">📈 7-Day Activity Trend</h2>
          <div className="grid grid-cols-7 gap-2 items-end h-32">
            {data.daily_trend.slice(-7).map(d => {
              const maxDeals = Math.max(...data.daily_trend.map(x => x.deals_added), 1);
              const h = Math.round((d.deals_added / maxDeals) * 100);
              return (
                <div key={d._id} className="flex flex-col items-center gap-1">
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d.deals_added}</span>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(h, 4)}%`, background: 'var(--gold)', opacity: 0.8, minHeight: 4 }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d._id.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Bars = deals added per day. Dates in MM-DD format.</p>
        </div>
      )}
    </main>
  );
}
