'use client';

import { useState } from 'react';
import {
  KPICard,
  SectionHeader,
  AdminCard,
  ActionButton,
  Badge,
} from '@/components/admin';

// ── Live Quality Audit ──────────────────────────────────────────────────────
export function LiveAuditPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content-audit');
      const d = await res.json();
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminCard>
      <SectionHeader title="Live Quality Audit" sub="run on-demand quality sweep" />
      <ActionButton onClick={runAudit} loading={loading}>
        🔍 Run Audit Now
      </ActionButton>

      {data && (
        <div className="mt-4 space-y-4">
          {data.suspectDiscounts?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>
                ⚠ Suspect Discounts (&gt;85%) — {data.suspectDiscounts.length} deals
              </p>
              <div className="space-y-1">
                {data.suspectDiscounts.slice(0, 5).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--sm-border)' }}>
                    <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{d.title}</span>
                    <Badge color="red">{d.discount_percent}% off</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.meeshoInflated?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#f59e0b' }}>
                ⚠ Meesho MRP Inflation — {data.meeshoInflated.length} deals
              </p>
              <div className="space-y-1">
                {data.meeshoInflated.slice(0, 5).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--sm-border)' }}>
                    <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{d.title}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>₹{d.original_price} → ₹{d.discounted_price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.lowScoreTrending?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>
                ⚠ Trending but Low Score (&lt;50) — {data.lowScoreTrending.length} deals
              </p>
              <div className="space-y-1">
                {data.lowScoreTrending.slice(0, 5).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--sm-border)' }}>
                    <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{d.title}</span>
                    <Badge color="red">score: {d.deal_score}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.suspectDiscounts?.length === 0 && data.meeshoInflated?.length === 0 && data.lowScoreTrending?.length === 0 && (
            <p className="text-sm" style={{ color: '#22c55e' }}>✓ No critical quality issues found.</p>
          )}

          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Audited at: {new Date(data.auditedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </p>
        </div>
      )}
    </AdminCard>
  );
}

// ── Score Calibrator ────────────────────────────────────────────────────────
export function ScoreCalibrator() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calibrate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/calibrate-scores', { method: 'POST' });
      const d = await res.json();
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const healthColors: Record<string, string> = {
    good: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
    unknown: 'var(--text-muted)',
  };

  return (
    <AdminCard>
      <SectionHeader title="Shadow Score Calibrator" sub="AI-powered score health analysis" />
      <ActionButton onClick={calibrate} loading={loading}>
        ⚡ Analyse Score Health
      </ActionButton>

      {data?.analysis && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: healthColors[data.analysis.health] || 'white' }}>
              Health: {data.analysis.health?.toUpperCase()}
            </span>
            <Badge color={data.analysis.meesho_inflation_risk === 'high' ? 'red' : data.analysis.meesho_inflation_risk === 'medium' ? 'amber' : 'green'}>
              Meesho risk: {data.analysis.meesho_inflation_risk}
            </Badge>
          </div>

          {data.analysis.summary && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {data.analysis.summary}
            </p>
          )}

          {data.analysis.issues?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>Issues</p>
              <ul className="space-y-1">
                {data.analysis.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#ef4444' }}>•</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.analysis.recommendations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#22c55e' }}>Recommendations</p>
              <ul className="space-y-1">
                {data.analysis.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#22c55e' }}>→</span> {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
}

// ── Algolia Health Check ────────────────────────────────────────────────────
export function AlgoliaHealthCheck() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/algolia-health');
      setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminCard>
      <SectionHeader title="Algolia Index Health" sub="search index vs MongoDB sync" />
      <ActionButton onClick={check} loading={loading} variant="ghost">
        🔍 Check Index
      </ActionButton>

      {data && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <KPICard label="MongoDB Active" value={data.mongoActiveDeals?.toLocaleString('en-IN') || '—'} accent="blue" />
          </div>

          {!data.algoliaAvailable && (
            <p className="text-xs" style={{ color: '#f59e0b' }}>⚠ {data.note}</p>
          )}

          {data.searchTests && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Search Quality Tests</p>
              <div className="space-y-1">
                {data.searchTests.map((t: any) => (
                  <div key={t.query} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>"{t.query}"</span>
                    <Badge color={t.nbHits > 0 ? 'green' : 'red'}>{t.nbHits > 0 ? `${t.nbHits} hits` : 'No results'}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
}
