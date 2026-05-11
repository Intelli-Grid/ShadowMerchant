import { connectDB } from '@/lib/db';
import ScrapeLog from '@/models/ScrapeLog';
import Deal from '@/models/Deal';
import {
  KPICard,
  StatusPill,
  ScrapeLogRow,
  SectionHeader,
  AdminCard,
  Badge,
} from '@/components/admin';
import { ScraperTrigger, DeadDealCleaner } from './_ScraperControls';

// ── Server-side data fetcher ─────────────────────────────────────────────────
async function getScraperAgentData() {
  await connectDB();

  const [
    platformStats,
    dealsDeactivatedLast24h,
    dealsWithEmptyUrl,
    dealsWithShortTitle,
    totalActive,
    allLogs,
  ] = await Promise.all([
    // Per-platform 7-day breakdown
    ScrapeLog.aggregate([
      { $match: { started_at: { $gte: new Date(Date.now() - 7 * 86400000) } } },
      { $unwind: '$results' },
      {
        $group: {
          _id: '$results.source',
          totalRuns:       { $sum: 1 },
          successRuns:     { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          totalDealsFound: { $sum: '$results.deals_found' },
          totalDealsNew:   { $sum: '$results.deals_inserted' },
          totalErrors:     { $sum: '$results.errors_count' },
          avgDuration:     { $avg: { $divide: ['$results.duration_ms', 1000] } },
          lastRun:         { $max: '$started_at' },
        },
      },
      { $sort: { totalDealsFound: -1 } },
    ]),

    // Dead deal metrics
    Deal.countDocuments({
      is_active: false,
      updated_at: { $gte: new Date(Date.now() - 86400000) },
    }),
    Deal.countDocuments({ affiliate_url: { $in: ['', null] } }),
    Deal.countDocuments({ is_active: true, $expr: { $lt: [{ $strLenCP: '$title' }, 15] } }),

    Deal.countDocuments({ is_active: true }),

    // Recent 12 runs overall
    ScrapeLog.find({}).sort({ started_at: -1 }).limit(12).lean(),
  ]);

  return {
    platformStats,
    dealsDeactivatedLast24h,
    dealsWithEmptyUrl,
    dealsWithShortTitle,
    totalActive,
    allLogs,
  };
}


// ── Platform Stats Table ──────────────────────────────────────────────────────
function PlatformStatsTable({ stats }: { stats: any[] }) {
  if (!stats.length) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No scraper data for last 7 days.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--sm-border)' }}>
            {['Platform', 'Success Rate', 'Deals Found', 'Deals New', 'Errors', 'Avg Duration', 'Last Run'].map((h) => (
              <th key={h} className="text-left py-2 pr-4 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((p: any) => {
            const successRate = p.totalRuns > 0 ? Math.round((p.successRuns / p.totalRuns) * 100) : 0;
            const hoursAgo = p.lastRun
              ? Math.round((Date.now() - new Date(p.lastRun).getTime()) / 3600000)
              : null;
            return (
              <tr key={p._id} style={{ borderBottom: '1px solid var(--sm-border)' }}>
                <td className="py-2.5 pr-4 font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{p._id}</td>
                <td className="py-2.5 pr-4">
                  <Badge color={successRate >= 80 ? 'green' : successRate >= 50 ? 'amber' : 'red'}>
                    {successRate}%
                  </Badge>
                </td>
                <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)' }}>{p.totalDealsFound?.toLocaleString('en-IN') || 0}</td>
                <td className="py-2.5 pr-4" style={{ color: '#22c55e' }}>+{p.totalDealsNew?.toLocaleString('en-IN') || 0}</td>
                <td className="py-2.5 pr-4">
                  {p.totalErrors > 0
                    ? <Badge color="red">{p.totalErrors}</Badge>
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                  }
                </td>
                <td className="py-2.5 pr-4" style={{ color: 'var(--text-muted)' }}>
                  {p.avgDuration ? `${Math.round(p.avgDuration)}s` : '—'}
                </td>
                <td className="py-2.5" style={{ color: 'var(--text-muted)' }}>
                  {hoursAgo !== null ? `${hoursAgo}h ago` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


export default async function ScraperAgentPage() {
  const data = await getScraperAgentData();

  const totalSuccessRuns = data.platformStats.reduce((s: number, p: any) => s + (p.successRuns || 0), 0);
  const totalRuns = data.platformStats.reduce((s: number, p: any) => s + (p.totalRuns || 0), 0);
  const overallSuccessRate = totalRuns > 0 ? Math.round((totalSuccessRuns / totalRuns) * 100) : 0;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'white', fontFamily: 'var(--font-display)' }}>
          🤖 Scraper Agents
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Monitor and control the Python scraper pipeline
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Success Rate (7d)" value={`${overallSuccessRate}%`} accent={overallSuccessRate >= 80 ? 'green' : overallSuccessRate >= 60 ? 'amber' : 'red'} />
        <KPICard label="Empty Affiliate URLs" value={data.dealsWithEmptyUrl.toString()} sub="data quality issue" accent={data.dealsWithEmptyUrl > 0 ? 'red' : 'green'} />
        <KPICard label="Short Titles (<15 chars)" value={data.dealsWithShortTitle.toString()} sub="garbage titles" accent={data.dealsWithShortTitle > 10 ? 'amber' : 'green'} />
        <KPICard label="Deactivated Last 24h" value={data.dealsDeactivatedLast24h.toString()} sub="went inactive" accent="amber" />
      </div>

      {/* Platform stats + recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AdminCard className="lg:col-span-2">
          <SectionHeader title="Platform Performance (7d)" sub="per-source breakdown" />
          <PlatformStatsTable stats={data.platformStats} />
        </AdminCard>

        <AdminCard>
          <SectionHeader title="Recent Runs" />
          {data.allLogs.map((log: any, i: number) => (
            <ScrapeLogRow key={i} log={log} />
          ))}
        </AdminCard>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScraperTrigger />
        <DeadDealCleaner dealsDeactivatedLast24h={data.dealsDeactivatedLast24h} />
      </div>
    </div>
  );
}
