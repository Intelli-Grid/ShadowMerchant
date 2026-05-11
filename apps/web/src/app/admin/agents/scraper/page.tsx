'use client';

import { useState } from 'react';
import { connectDB } from '@/lib/db';
import ScrapeLog from '@/models/ScrapeLog';
import Deal from '@/models/Deal';
import {
  KPICard,
  StatusPill,
  ScrapeLogRow,
  SectionHeader,
  AdminCard,
  ActionButton,
  Badge,
} from '@/components/admin';

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

// ── Scraper Trigger Client Component ─────────────────────────────────────────
function ScraperTrigger() {
  const [platform, setPlatform] = useState('all');
  const [mode, setMode] = useState('standard');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const trigger = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/admin/trigger-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus('success');
      setMessage(data.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <AdminCard>
      <SectionHeader title="Manual Trigger" sub="dispatch a GitHub Actions scraper run" />
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--bg-raised)',
            color: 'var(--text-primary)',
            border: '1px solid var(--sm-border)',
          }}
        >
          {['all', 'amazon', 'flipkart', 'meesho', 'myntra', 'nykaa', 'croma', 'tatacliq'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--bg-raised)',
            color: 'var(--text-primary)',
            border: '1px solid var(--sm-border)',
          }}
        >
          <option value="standard">standard</option>
          <option value="deep">deep</option>
          <option value="flash">flash</option>
        </select>
        <ActionButton onClick={trigger} loading={status === 'loading'}>
          ▶ Trigger Scraper
        </ActionButton>
      </div>
      {message && (
        <p
          className="text-xs p-3 rounded-lg"
          style={{
            background: status === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            color: status === 'success' ? '#22c55e' : '#ef4444',
            border: `1px solid ${status === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {message}
        </p>
      )}
    </AdminCard>
  );
}

// ── Dead Deal Cleaner Client Component ─────────────────────────────────────
function DeadDealCleaner({ dealsDeactivatedLast24h }: { dealsDeactivatedLast24h: number }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const dryRun = async () => {
    setStatus('loading');
    const res = await fetch('/api/admin/clean-deals?dryRun=true', { method: 'POST' });
    const data = await res.json();
    setResult({ ...data, mode: 'dry' });
    setStatus('success');
  };

  const execute = async () => {
    if (!confirm('This will deactivate stale deals and permanently delete old ones. Continue?')) return;
    setStatus('loading');
    const res = await fetch('/api/admin/clean-deals', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setStatus('error'); setResult({ error: data.error }); return; }
    setResult({ ...data, mode: 'live' });
    setStatus('success');
  };

  return (
    <AdminCard>
      <SectionHeader title="Dead Deal Cleaner" sub="stale deal lifecycle management" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Deactivated Last 24h</p>
          <p className="text-xl font-black" style={{ color: dealsDeactivatedLast24h > 50 ? '#ef4444' : 'var(--gold)' }}>
            {dealsDeactivatedLast24h}
          </p>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <ActionButton onClick={dryRun} loading={status === 'loading'} variant="ghost">
          🔍 Dry Run
        </ActionButton>
        <ActionButton onClick={execute} loading={status === 'loading'} variant="danger">
          🗑 Clean Now
        </ActionButton>
      </div>
      {result && (
        <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
          {result.mode === 'dry' ? (
            <span>Would deactivate <strong>{result.wouldDeactivate}</strong> deals · Would delete <strong>{result.wouldDelete}</strong> deals</span>
          ) : result.error ? (
            <span className="text-red-400">Error: {result.error}</span>
          ) : (
            <span>✓ Deactivated <strong>{result.deactivated}</strong> · Deleted <strong>{result.deleted}</strong> · Cache busted</span>
          )}
        </div>
      )}
    </AdminCard>
  );
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

// ── Server Component Page ─────────────────────────────────────────────────────
// Note: client sub-components are imported separately
import { KPICard as KPICardServer } from '@/components/admin';

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
