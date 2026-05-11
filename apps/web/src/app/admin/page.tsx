import { Suspense } from 'react';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import User from '@/models/User';
import Alert from '@/models/Alert';
import ScrapeLog from '@/models/ScrapeLog';
import { redis } from '@/lib/redis';
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
  const scraperHealthy = scraperLastLog
    ? Date.now() - new Date(scraperLastLog.started_at).getTime() < 26 * 3600 * 1000
    : false;
  const cacheHealthy = data.cache.dbSize > 0;
  const dataHealthy = data.deals.last24h > 0;

  const generatedIST = new Date(data.generatedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-8 pb-12">
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

        {/* System status pills */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
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

      {/* ── AI Brain Query Panel ────────────────────────────────────────── */}
      <Suspense fallback={<div />}>
        <AgentQueryPanel />
      </Suspense>
    </div>
  );
}
