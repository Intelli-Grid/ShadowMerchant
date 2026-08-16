import { Suspense } from 'react';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import User from '@/models/User';
import Alert from '@/models/Alert';
import ScrapeLog from '@/models/ScrapeLog';
import { redis } from '@/lib/redis';

// PERF-03: Cache the RSC render for 60 seconds.
// The admin page runs 12 parallel DB queries + 3 aggregation pipelines on every load.
// At 1-min cache, a burst of admin page refreshes won't hammer MongoDB.
export const revalidate = 60;

import {
  KPICard,
  StatusPill,
  PlatformRow,
  ScrapeLogRow,
  ScoreDistributionChart,
  AdminCard,
  SectionHeader,
} from '@/components/admin';
import { AgentQueryPanel } from '@/components/admin/AgentQueryPanel';
import { MissionControlRefreshButton } from './_MissionControlRefreshButton';

// ── Data fetcher ─────────────────────────────────────────────────────────────
async function getMissionControlData() {
  await connectDB();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const last7days = new Date(now.getTime() - 7 * 86400000);

  const [
    totalDeals,
    activeDeals,
    dealsLast24h,
    trendingDeals,
    totalUsers,
    proUsers,
    newUsersLast7d,
    totalAlerts,
    activeAlerts,
    alertsFiredLast7d,
    lastScrapeLog,
    recentScrapeLogs,
    redisDbSize,
  ] = await Promise.all([
    Deal.countDocuments({}),
    Deal.countDocuments({ is_active: true }),
    Deal.countDocuments({ scraped_at: { $gte: yesterday }, is_active: true }),
    Deal.countDocuments({ is_trending: true, is_active: true }),
    User.countDocuments({}),
    User.countDocuments({ subscription_tier: 'pro' }),
    User.countDocuments({ created_at: { $gte: last7days } }),
    Alert.countDocuments({}),
    Alert.countDocuments({ is_active: true }),
    Alert.countDocuments({ last_triggered: { $gte: last7days } }),
    ScrapeLog.findOne({}).sort({ started_at: -1 }).lean(),
    ScrapeLog.find({}).sort({ started_at: -1 }).limit(10).lean(),
    // Use dbsize instead of KEYS for O(1) performance
    (redis as any).dbsize?.().catch(() => 0) ?? Promise.resolve(0),
  ]);

  // Platform breakdown of active deals
  const platformBreakdown = await Deal.aggregate([
    { $match: { is_active: true } },
    {
      $group: {
        _id: '$source_platform',
        count: { $sum: 1 },
        avgScore: { $avg: '$deal_score' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Score distribution (quality health check)
  const scoreDistribution = await Deal.aggregate([
    { $match: { is_active: true } },
    {
      $bucket: {
        groupBy: '$deal_score',
        boundaries: [0, 20, 40, 60, 80, 101],
        default: 'other',
        output: { count: { $sum: 1 } },
      },
    },
  ]);

  // Affiliate click analytics (total clicks on active deals)
  const clickAnalytics = await Deal.aggregate([
    { $match: { is_active: true, click_count: { $gt: 0 } } },
    {
      $group: {
        _id: '$source_platform',
        totalClicks: { $sum: '$click_count' },
        dealCount:   { $sum: 1 },
      },
    },
    { $sort: { totalClicks: -1 } },
  ]);

  // Top 10 clicked deals today
  const topClickedDeals = await Deal.find({ is_active: true, click_count: { $gt: 0 } })
    .sort({ click_count: -1 })
    .limit(10)
    .select('title source_platform click_count discounted_price deal_score discount_percent')
    .lean();

  // Signup source breakdown (requires UTM attribution to be active)
  const signupSourceBreakdown = await User.aggregate([
    { $group: { _id: { $ifNull: ['$signup_source', 'direct'] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const totalClicks = clickAnalytics.reduce((s: number, p: any) => s + p.totalClicks, 0);

  return {
    deals: {
      total: totalDeals,
      active: activeDeals,
      last24h: dealsLast24h,
      trending: trendingDeals,
      platformBreakdown,
      scoreDistribution,
    },
    users: { total: totalUsers, pro: proUsers, newLast7d: newUsersLast7d },
    alerts: { total: totalAlerts, active: activeAlerts, firedLast7d: alertsFiredLast7d },
    scraper: { lastLog: lastScrapeLog, recentLogs: recentScrapeLogs },
    cache: { dbSize: typeof redisDbSize === 'number' ? redisDbSize : 0 },
    clicks: { byPlatform: clickAnalytics, topDeals: topClickedDeals, total: totalClicks },
    acquisition: { signupSources: signupSourceBreakdown },
    generatedAt: now.toISOString(),
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function AdminDashboard() {
  const data = await getMissionControlData();

  const proConversionRate =
    data.users.total > 0
      ? ((data.users.pro / data.users.total) * 100).toFixed(1)
      : '0';

  // System health signals
  const scraperLastLog = data.scraper.lastLog as any;
  // Tightened from 26h → 8h: 26h is two full pipeline runs, far too forgiving
  const scraperHealthy = scraperLastLog
    ? Date.now() - new Date(scraperLastLog.started_at).getTime() < 8 * 3600 * 1000
    : false;
  // Critical: > 14h since last done log = likely missed a run
  const scraperCritical = scraperLastLog
    ? Date.now() - new Date(scraperLastLog.started_at).getTime() > 14 * 3600 * 1000 || scraperLastLog.status === 'failed'
    : true;
  const cacheHealthy = data.cache.dbSize > 0;
  const dataHealthy = data.deals.last24h > 0;

  const generatedIST = new Date(data.generatedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-8 pb-12">
      {/* ── Scraper Failure Banner ─────────────────────────────────────────── */}
      {scraperCritical && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <span className="text-red-400 text-lg mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-bold text-red-400">
              {scraperLastLog?.status === 'failed'
                ? 'Scraper run FAILED'
                : `No scraper activity in ${scraperLastLog ? Math.round((Date.now() - new Date(scraperLastLog.started_at).getTime()) / 3600000) : '?'}h`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Deal inventory may be stale. Check GitHub Actions → scrape.yml and verify the pipeline is running.
              {scraperLastLog?.error_message && (
                <span className="block mt-1 text-red-300/70 font-mono">{scraperLastLog.error_message.slice(0, 120)}</span>
              )}
            </p>
          </div>
        </div>
      )}
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ color: 'white', fontFamily: 'var(--font-display)' }}
          >
            ⚡ Mission Control
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Last refreshed: {generatedIST} IST
          </p>
        </div>

        {/* System status pills + refresh */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <MissionControlRefreshButton />
          <StatusPill label="Scraper" healthy={scraperHealthy} />
          <StatusPill label="Cache" healthy={cacheHealthy} />
          <StatusPill label="Data Feed" healthy={dataHealthy} />
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Active Deals"
          value={data.deals.active.toLocaleString('en-IN')}
          sub={`+${data.deals.last24h} today`}
          accent="gold"
        />
        <KPICard
          label="Trending Now"
          value={data.deals.trending.toString()}
          sub="is_trending = true"
          accent="green"
        />
        <KPICard
          label="Total Users"
          value={data.users.total.toLocaleString('en-IN')}
          sub={`+${data.users.newLast7d} this week`}
          accent="blue"
        />
        <KPICard
          label="Pro Members"
          value={data.users.pro.toString()}
          sub={`${proConversionRate}% conversion`}
          accent="gold"
        />
        <KPICard
          label="Live Alerts"
          value={data.alerts.active.toString()}
          sub={`${data.alerts.firedLast7d} fired/7d`}
          accent="amber"
        />
        <KPICard
          label="Redis Keys"
          value={data.cache.dbSize.toLocaleString('en-IN')}
          sub={cacheHealthy ? 'Cache active' : 'Cache empty'}
          accent={cacheHealthy ? 'green' : 'red'}
        />
      </div>

      {/* ── Secondary Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Deals (All Time)"
          value={data.deals.total.toLocaleString('en-IN')}
          sub="incl. deactivated"
          accent="gold"
        />
        <KPICard
          label="Total Alerts (All)"
          value={data.alerts.total.toString()}
          sub={`${data.alerts.active} currently active`}
          accent="amber"
        />
        <KPICard
          label="Free Users"
          value={(data.users.total - data.users.pro).toLocaleString('en-IN')}
          sub="potential upgrade targets"
          accent="blue"
        />
        <KPICard
          label="Pro Conversion"
          value={`${proConversionRate}%`}
          sub="free → pro rate"
          accent={parseFloat(proConversionRate) >= 5 ? 'green' : parseFloat(proConversionRate) >= 2 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Data panels ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Breakdown */}
        <AdminCard>
          <SectionHeader title="Platform Mix" sub="active deals by source" />
          {data.deals.platformBreakdown.length > 0 ? (
            data.deals.platformBreakdown.map((p: any) => (
              <PlatformRow
                key={p._id}
                platform={p._id}
                count={p.count}
                avgScore={p.avgScore ?? 0}
                total={data.deals.active}
              />
            ))
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No active deals found.
            </p>
          )}
        </AdminCard>

        {/* Score Quality Health */}
        <AdminCard>
          <SectionHeader title="Score Quality" sub="deal score distribution" />
          {data.deals.scoreDistribution.length > 0 ? (
            <ScoreDistributionChart data={data.deals.scoreDistribution} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No score data available.
            </p>
          )}
        </AdminCard>

        {/* Recent Scraper Runs */}
        <AdminCard>
          <SectionHeader
            title="Recent Scraper Runs"
            sub={`last run: ${
              scraperLastLog
                ? `${Math.round(
                    (Date.now() - new Date(scraperLastLog.started_at).getTime()) / 3600000
                  )}h ago`
                : 'never'
            }`}
          />
          {data.scraper.recentLogs.length > 0 ? (
            data.scraper.recentLogs.map((log: any, i: number) => (
              <ScrapeLogRow key={i} log={log} />
            ))
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No scrape logs found.
            </p>
          )}
        </AdminCard>
      </div>

      {/* ── Click Analytics ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Affiliate Clicks by Platform */}
        <AdminCard>
          <SectionHeader
            title="Affiliate Clicks — All Time"
            sub={`${data.clicks.total.toLocaleString('en-IN')} total tracked clicks`}
          />
          {data.clicks.byPlatform.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {data.clicks.byPlatform.map((p: any) => {
                const pct = data.clicks.total > 0 ? Math.round((p.totalClicks / data.clicks.total) * 100) : 0;
                return (
                  <div key={p._id} className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold capitalize w-16 shrink-0"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {p._id}
                    </span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-raised)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: 'var(--gold)' }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold w-10 text-right shrink-0"
                      style={{ color: 'var(--gold)' }}
                    >
                      {p.totalClicks.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No click data yet. Clicks track when users hit /api/go/[id].
            </p>
          )}
        </AdminCard>

        {/* Acquisition — Signup Source Breakdown */}
        <AdminCard>
          <SectionHeader
            title="Acquisition — Signup Sources"
            sub="requires PostHog + UTM attribution active"
          />
          {data.acquisition.signupSources.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {data.acquisition.signupSources.map((s: any) => {
                const pct = data.users.total > 0
                  ? Math.round((s.count / data.users.total) * 100)
                  : 0;
                return (
                  <div key={s._id} className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold w-20 shrink-0 truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {s._id || 'direct'}
                    </span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-raised)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: '#60A5FA' }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold w-6 text-right shrink-0"
                      style={{ color: '#60A5FA' }}
                    >
                      {s.count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No source data. Set POSTHOG env vars + UTM params will populate this.
            </p>
          )}
        </AdminCard>
      </div>

      {/* ── Top Clicked Deals ─────────────────────────────────────────────── */}
      {data.clicks.topDeals.length > 0 && (
        <AdminCard>
          <SectionHeader title="Top Clicked Deals" sub="highest affiliate traffic — all time" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left pb-2 font-bold uppercase tracking-wider pr-4">Deal</th>
                  <th className="text-left pb-2 font-bold uppercase tracking-wider pr-4">Platform</th>
                  <th className="text-left pb-2 font-bold uppercase tracking-wider pr-4">Score</th>
                  <th className="text-left pb-2 font-bold uppercase tracking-wider pr-4">Price</th>
                  <th className="text-right pb-2 font-bold uppercase tracking-wider">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.clicks.topDeals.map((d: any, i: number) => (
                  <tr
                    key={String(d._id)}
                    className="border-t"
                    style={{ borderColor: 'var(--sm-border)' }}
                  >
                    <td className="py-2 pr-4 max-w-[220px]">
                      <span
                        className="block truncate font-medium"
                        style={{ color: 'var(--text-primary)' }}
                        title={d.title}
                      >
                        {i + 1}. {d.title}
                      </span>
                    </td>
                    <td className="py-2 pr-4 capitalize" style={{ color: 'var(--text-secondary)' }}>
                      {d.source_platform}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="font-bold"
                        style={{
                          color: d.deal_score >= 80 ? '#22c55e' : d.deal_score >= 60 ? '#f59e0b' : '#ef4444',
                        }}
                      >
                        {Math.round(d.deal_score ?? 0)}
                      </span>
                    </td>
                    <td className="py-2 pr-4" style={{ color: 'var(--text-secondary)' }}>
                      ₹{d.discounted_price?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 text-right font-bold" style={{ color: 'var(--gold)' }}>
                      {d.click_count?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* ── AI Brain Query Panel ────────────────────────────────────────── */}
      <Suspense fallback={<div />}>
        <AgentQueryPanel />
      </Suspense>
    </div>
  );
}
