import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import {
  KPICard,
  SectionHeader,
  AdminCard,
  Badge,
} from '@/components/admin';
import { LiveAuditPanel, ScoreCalibrator, AlgoliaHealthCheck } from './_ContentControls';

// ── Server-side data fetch ────────────────────────────────────────────────────
async function getContentData() {
  await connectDB();

  const [
    totalActive,
    suspectDiscountCount,
    shortTitleCount,
    missingImageCount,
    lowScoreTrendingCount,
    topDeals,
  ] = await Promise.all([
    Deal.countDocuments({ is_active: true }),
    Deal.countDocuments({ is_active: true, discount_percent: { $gt: 85 } }),
    Deal.countDocuments({ is_active: true, $expr: { $lt: [{ $strLenCP: '$title' }, 15] } }),
    Deal.countDocuments({ is_active: true, $or: [{ image_url: '' }, { image_url: null }] }),
    Deal.countDocuments({ is_active: true, is_trending: true, deal_score: { $lt: 50 } }),
    Deal.find(
      { is_active: true },
      { title: 1, deal_score: 1, source_platform: 1, discount_percent: 1, is_trending: 1 }
    )
      .sort({ deal_score: -1 })
      .limit(10)
      .lean(),
  ]);

  return {
    totalActive,
    suspectDiscountCount,
    shortTitleCount,
    missingImageCount,
    lowScoreTrendingCount,
    topDeals,
  };
}

// ── Page (Server Component) ───────────────────────────────────────────────────
export default async function ContentAgentPage() {
  const data = await getContentData();

  const qualityScore = Math.round(
    100 -
      ((data.suspectDiscountCount + data.shortTitleCount * 0.5 + data.missingImageCount * 0.3 + data.lowScoreTrendingCount * 2) /
        Math.max(data.totalActive, 1)) *
        100
  );

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'white', fontFamily: 'var(--font-display)' }}>
          📊 Content Agents
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Deal quality, Shadow Score calibration, and search index health
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Active Deals" value={data.totalActive.toLocaleString('en-IN')} accent="gold" />
        <KPICard label="Suspect Discounts" value={data.suspectDiscountCount.toString()} sub=">85% off" accent={data.suspectDiscountCount > 0 ? 'red' : 'green'} />
        <KPICard label="Missing Images" value={data.missingImageCount.toString()} accent={data.missingImageCount > 10 ? 'amber' : 'green'} />
        <KPICard label="Low-Score Trending" value={data.lowScoreTrendingCount.toString()} sub="score <50 but trending" accent={data.lowScoreTrendingCount > 0 ? 'red' : 'green'} />
      </div>

      {/* Top deals preview */}
      <AdminCard>
        <SectionHeader title="Top Deals by Score" sub="highest scoring active deals" />
        <div className="space-y-1">
          {data.topDeals.map((d: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-2"
              style={{ borderBottom: '1px solid var(--sm-border)' }}
            >
              <span className="flex-1 truncate mr-3" style={{ color: 'var(--text-secondary)' }}>
                {d.title}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge color={d.is_trending ? 'gold' : 'blue'}>{d.source_platform}</Badge>
                <Badge color={d.deal_score >= 80 ? 'green' : d.deal_score >= 60 ? 'amber' : 'red'}>
                  {d.deal_score}/100
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Interactive panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveAuditPanel />
        <ScoreCalibrator />
      </div>

      <AlgoliaHealthCheck />
    </div>
  );
}
