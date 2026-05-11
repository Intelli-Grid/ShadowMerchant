'use client';

import { useState } from 'react';
import {
  SectionHeader,
  AdminCard,
  ActionButton,
} from '@/components/admin';

// ── Scraper Trigger ─────────────────────────────────────────────────────────
export function ScraperTrigger() {
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

// ── Dead Deal Cleaner ───────────────────────────────────────────────────────
export function DeadDealCleaner({ dealsDeactivatedLast24h }: { dealsDeactivatedLast24h: number }) {
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
