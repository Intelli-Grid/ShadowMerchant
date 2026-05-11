import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import User from '@/models/User';
import {
  KPICard,
  SectionHeader,
  AdminCard,
  Badge,
  StatusPill,
} from '@/components/admin';

// ── Types ────────────────────────────────────────────────────────────────────
interface DailyPoint { _id: string; count: number; }
interface CategoryStat { _id: string; count: number; avgScore: number; avgDiscount: number; }
interface ClickCategory { _id: string; totalClicks: number; dealCount: number; avgScore: number; }
interface VelocityDeal { _id: string; title: string; velocity_score: number; click_count: number; deal_score: number; source_platform: string; category: string; }

// ── Server data fetch ─────────────────────────────────────────────────────────
async function getGrowthData() {
  await connectDB();

  const now = new Date();
  const last7d  = new Date(now.getTime() - 7  * 86400000);
  const last30d = new Date(now.getTime() - 30 * 86400000);

  const [
    usersTotal, usersLast7d, usersLast30d, proLast30d,
    userGrowthDaily, dealsLast7d, dealsLast30d, dealsGrowthDaily,
    categoryStats, topClickCategories, velocityDeals,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ created_at: { $gte: last7d } }),
    User.countDocuments({ created_at: { $gte: last30d } }),
    User.countDocuments({ subscription_tier: 'pro', created_at: { $gte: last30d } }),
    User.aggregate([
      { $match: { created_at: { $gte: new Date(now.getTime() - 14 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Deal.countDocuments({ scraped_at: { $gte: last7d }, is_active: true }),
    Deal.countDocuments({ scraped_at: { $gte: last30d }, is_active: true }),
    Deal.aggregate([
      { $match: { scraped_at: { $gte: new Date(now.getTime() - 14 * 86400000) }, is_active: true } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$scraped_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Deal.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgScore: { $avg: '$deal_score' }, avgDiscount: { $avg: '$discount_percent' } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    Deal.aggregate([
      { $match: { is_active: true, click_count: { $gt: 0 } } },
      { $group: { _id: '$category', totalClicks: { $sum: '$click_count' }, dealCount: { $sum: 1 }, avgScore: { $avg: '$deal_score' } } },
      { $sort: { totalClicks: -1 } },
      { $limit: 8 },
    ]),
    Deal.find(
      { is_active: true, velocity_score: { $gt: 0 } },
      { title: 1, velocity_score: 1, click_count: 1, deal_score: 1, source_platform: 1, category: 1 }
    ).sort({ velocity_score: -1 }).limit(6).lean(),
  ]);

  return {
    usersTotal, usersLast7d, usersLast30d, proLast30d,
    userGrowthDaily, dealsLast7d, dealsLast30d, dealsGrowthDaily,
    categoryStats, topClickCategories, velocityDeals,
  };
}

// ── SEO health fetcher (inline — avoids self-HTTP call from server component) ─
async function getSEOData() {
  const domain =
    (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shadowmerchant.online').replace(/\/$/, '');

  /** Fetch URL and return status, with 8-second timeout */
  async function checkUrl(url: string) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'ShadowMerchant-Admin-Bot/1.0' },
      });
      clearTimeout(t);
      return { url, status: res.status, ok: res.ok };
    } catch {
      return { url, status: null as null | number, ok: false };
    }
  }

  await connectDB();

  const [activeDeals, rawCategories, homepageCheck, sitemapCheck, robotsCheck] =
    await Promise.all([
      Deal.countDocuments({ is_active: true }),
      Deal.distinct('category', { is_active: true }),
      checkUrl(domain),
      checkUrl(`${domain}/sitemap.xml`),
      checkUrl(`${domain}/robots.txt`),
    ]);

  const activeCategories = (rawCategories as (string | null)[]).filter(Boolean);
  const staticPages = 5;
  const totalIndexablePages = activeDeals + activeCategories.length + staticPages;

  // Parse sitemap URL count
  let sitemapUrlCount: number | null = null;
  let sitemapSample: string[] = [];
  if (sitemapCheck.ok) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(`${domain}/sitemap.xml`, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'ShadowMerchant-Admin-Bot/1.0' },
      });
      clearTimeout(t);
      const xml = await res.text();
      sitemapUrlCount = (xml.match(/<loc>/g) ?? []).length;
      sitemapSample = (xml.match(/<loc>([^<]+)<\/loc>/g) ?? [])
        .slice(0, 4)
        .map((m) => m.replace(/<\/?loc>/g, ''));
    } catch { /* non-fatal */ }
  }

  // Parse robots.txt
  let robotsBlocksAdmin = false;
  let robotsAllowsIndexing = false;
  if (robotsCheck.ok) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${domain}/robots.txt`, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'ShadowMerchant-Admin-Bot/1.0' },
      });
      clearTimeout(t);
      const txt = await res.text();
      robotsBlocksAdmin =
        txt.includes('Disallow: /admin') || txt.includes('Disallow: /admin/');
      robotsAllowsIndexing =
        txt.includes('Allow: /') ||
        (!txt.includes('Disallow: /\n') && !txt.includes('Disallow: / '));
    } catch { /* non-fatal */ }
  }

  // Composite health score
  let healthScore = 0;
  if (homepageCheck.ok) healthScore += 25;
  if (sitemapCheck.ok) healthScore += 25;
  if (robotsCheck.ok) healthScore += 15;
  if (robotsBlocksAdmin) healthScore += 10;
  if (sitemapUrlCount !== null && sitemapUrlCount > 10) healthScore += 15;
  if (activeDeals > 100) healthScore += 10;
  const healthLabel: 'good' | 'warning' | 'critical' =
    healthScore >= 80 ? 'good' : healthScore >= 50 ? 'warning' : 'critical';

  return {
    domain,
    indexablePages: { activeDeals, activeCategories: activeCategories.length, staticPages, total: totalIndexablePages },
    checks: { homepage: homepageCheck, sitemap: sitemapCheck, robots: robotsCheck },
    sitemap: { urlCount: sitemapUrlCount, sample: sitemapSample },
    robots: { allowsIndexing: robotsAllowsIndexing, blocksAdmin: robotsBlocksAdmin },
    health: { score: healthScore, label: healthLabel },
  };
}

// ── Spark bar chart (pure CSS inline, no recharts needed) ─────────────────────
function SparkBars({ data }: { data: DailyPoint[] }) {
  if (!data.length) return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No data</p>;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((d) => (
        <div
          key={d._id}
          className="flex-1 rounded-t transition-all duration-500 hover:opacity-80"
          title={`${d._id}: ${d.count}`}
          style={{
            height: `${Math.max((d.count / maxVal) * 100, 8)}%`,
            background: 'var(--gold)',
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function GrowthAgentPage() {
  const [data, seo] = await Promise.all([getGrowthData(), getSEOData()]);

  const conversionRate30d =
    data.usersLast30d > 0
      ? ((data.proLast30d / data.usersLast30d) * 100).toFixed(1)
      : '0';

  const generatedIST = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'white', fontFamily: 'var(--font-display)' }}>
            📈 Growth Agents
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            User growth, catalog expansion, and engagement signals
          </p>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{generatedIST} IST</p>
      </div>

      {/* Growth KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Users" value={data.usersTotal.toLocaleString('en-IN')} accent="blue" />
        <KPICard label="New Users (7d)" value={data.usersLast7d.toString()} accent="green" />
        <KPICard label="New Users (30d)" value={data.usersLast30d.toString()} sub={`${data.proLast30d} went Pro`} accent="blue" />
        <KPICard label="30d Pro Conversion" value={`${conversionRate30d}%`} accent={parseFloat(conversionRate30d) >= 5 ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="New Deals (7d)" value={data.dealsLast7d.toLocaleString('en-IN')} accent="gold" />
        <KPICard label="New Deals (30d)" value={data.dealsLast30d.toLocaleString('en-IN')} accent="gold" />
        <KPICard label="High Velocity Deals" value={(data.velocityDeals as VelocityDeal[]).length.toString()} sub="active velocity_score" accent="amber" />
        <KPICard label="Categories" value={data.categoryStats.length.toString()} sub="active catalog" accent="blue" />
      </div>

      {/* Spark charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard>
          <SectionHeader title="Daily Signups (14d)" sub="new user registrations per day" />
          <SparkBars data={data.userGrowthDaily as DailyPoint[]} />
          <div className="flex justify-between mt-1">
            {(data.userGrowthDaily as DailyPoint[]).map((d) => (
              <span key={d._id} className="text-[8px]" style={{ color: 'var(--text-muted)', flex: 1, textAlign: 'center' }}>
                {d._id.slice(5)} {/* MM-DD */}
              </span>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <SectionHeader title="Daily Deals Added (14d)" sub="new deals per day" />
          <SparkBars data={data.dealsGrowthDaily as DailyPoint[]} />
          <div className="flex justify-between mt-1">
            {(data.dealsGrowthDaily as DailyPoint[]).map((d) => (
              <span key={d._id} className="text-[8px]" style={{ color: 'var(--text-muted)', flex: 1, textAlign: 'center' }}>
                {d._id.slice(5)}
              </span>
            ))}
          </div>
        </AdminCard>
      </div>

      {/* Category stats + Top click categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard>
          <SectionHeader title="Category Depth" sub="active deals per category" />
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {(data.categoryStats as CategoryStat[]).map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between text-xs py-2"
                style={{ borderBottom: '1px solid var(--sm-border)' }}
              >
                <span className="capitalize flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {c._id || 'uncategorised'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span style={{ color: 'var(--text-muted)' }}>{c.count} deals</span>
                  <Badge color={c.avgScore >= 60 ? 'green' : c.avgScore >= 40 ? 'amber' : 'red'}>
                    avg {Math.round(c.avgScore)}/100
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <SectionHeader title="Most Clicked Categories" sub="highest affiliate engagement" />
          {(data.topClickCategories as ClickCategory[]).length > 0 ? (
            <div className="space-y-1">
              {(data.topClickCategories as ClickCategory[]).map((c, i) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between text-xs py-2"
                  style={{ borderBottom: '1px solid var(--sm-border)' }}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] font-bold" style={{ color: 'var(--gold)' }}>#{i + 1}</span>
                    <span className="capitalize truncate" style={{ color: 'var(--text-secondary)' }}>
                      {c._id || 'uncategorised'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{ color: 'var(--text-muted)' }}>{c.totalClicks} clicks</span>
                    <Badge color="blue">{c.dealCount} deals</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No click data yet.</p>
          )}
        </AdminCard>
      </div>

      {/* Velocity deals */}
      {(data.velocityDeals as VelocityDeal[]).length > 0 && (
        <AdminCard>
          <SectionHeader
            title="🔥 Viral Velocity Picks"
            sub="deals with highest click velocity score"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data.velocityDeals as VelocityDeal[]).map((d) => (
              <div
                key={String(d._id)}
                className="p-3 rounded-xl"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--sm-border)',
                }}
              >
                <p className="text-xs font-medium mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {d.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge color="gold">velocity: {d.velocity_score}</Badge>
                  <Badge color="blue">{d.source_platform}</Badge>
                  <Badge color={d.deal_score >= 60 ? 'green' : 'amber'}>{d.deal_score}/100</Badge>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {d.click_count} clicks total
                  </span>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* SEO Health Panel — live data */}
      <AdminCard>
        <div className="flex items-start justify-between mb-4">
          <SectionHeader
            title="🌐 SEO Health"
            sub={`${seo.domain} — ${seo.indexablePages.total.toLocaleString('en-IN')} indexable pages`}
          />
          <Badge
            color={
              seo.health.label === 'good'
                ? 'green'
                : seo.health.label === 'warning'
                ? 'amber'
                : 'red'
            }
          >
            {seo.health.score}/100 — {seo.health.label}
          </Badge>
        </div>

        {/* Live checks grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Homepage', check: seo.checks.homepage },
            { label: 'Sitemap XML', check: seo.checks.sitemap },
            { label: 'Robots TXT', check: seo.checks.robots },
          ].map(({ label, check }) => (
            <div
              key={label}
              className="flex items-center justify-between p-3 rounded-xl text-xs"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <StatusPill
                label={check.ok ? `${check.status} OK` : check.status ? `${check.status} ERR` : 'Timeout'}
                healthy={check.ok}
              />
            </div>
          ))}
        </div>

        {/* Indexable page breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Active Deals', value: seo.indexablePages.activeDeals },
            { label: 'Categories', value: seo.indexablePages.activeCategories },
            { label: 'Static Pages', value: seo.indexablePages.staticPages },
            { label: 'Total Indexable', value: seo.indexablePages.total },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="p-3 rounded-xl text-center"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}
            >
              <p className="text-lg font-black" style={{ color: 'var(--gold)' }}>
                {value.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Sitemap sample URLs */}
        {seo.sitemap.urlCount !== null && (
          <div className="mb-4">
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Sitemap contains{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {seo.sitemap.urlCount}
              </strong>{' '}
              URLs — sample:
            </p>
            <div className="space-y-1">
              {seo.sitemap.sample.map((url) => (
                <p key={url} className="text-[10px] truncate" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {url}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* robots.txt flags */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge color={seo.robots.allowsIndexing ? 'green' : 'red'}>
            {seo.robots.allowsIndexing ? '✓ Indexing allowed' : '✗ Indexing blocked'}
          </Badge>
          <Badge color={seo.robots.blocksAdmin ? 'green' : 'amber'}>
            {seo.robots.blocksAdmin ? '✓ /admin disallowed' : '⚠ /admin not explicitly blocked'}
          </Badge>
        </div>

        {/* Manual checklist */}
        <div
          className="mt-5 pt-4 space-y-1.5"
          style={{ borderTop: '1px solid var(--sm-border)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Manual Checks
          </p>
          {[
            'Google Search Console — verify shadowmerchant.online is submitted & indexed',
            'Core Web Vitals — monitor LCP and CLS via Vercel Analytics',
            'Deal pages have dynamic og:title + og:image for WhatsApp shares',
            'Amazon/Flipkart affiliate tags appended to all redirect URLs',
          ].map((item) => (
            <p key={item} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              • {item}
            </p>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
