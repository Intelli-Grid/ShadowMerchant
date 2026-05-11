'use client';

import { useState } from 'react';
import { Send, Loader2, Sparkles, RotateCcw } from 'lucide-react';

const SUGGESTED_QUERIES = [
  'Which platform has the worst data quality right now?',
  'How many Pro users are at churn risk this week?',
  "What's my free-to-Pro conversion rate?",
  'Are there any deals with inflated MRP I should be aware of?',
  "Summarise today's scraper performance",
  'Which categories are dominated by a single platform?',
  'Are there trending deals with a low shadow score?',
  "What's the health of the deal pipeline overall?",
];

export function AgentQueryPanel() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [dataUsed, setDataUsed] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);

  const handleQuery = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setDataUsed(null);

    try {
      const res = await fetch('/api/admin/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();
      setResponse(data.response);
      setDataUsed(data.dataUsed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setQuery('');
    setResponse(null);
    setDataUsed(null);
    setError(null);
  };

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--gold-border)',
        boxShadow: '0 0 40px rgba(201,168,76,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--gold)' }} />
          <h2 className="font-bold text-sm" style={{ color: 'white' }}>
            Ask Your Business Brain
          </h2>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-1"
            style={{
              background: 'var(--gold-dim)',
              color: 'var(--gold)',
              border: '1px solid var(--gold-border)',
            }}
          >
            Claude Powered
          </span>
        </div>
        {(response || error) && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Suggested query chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SUGGESTED_QUERIES.slice(0, 4).map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuery(q);
              handleQuery(q);
            }}
            disabled={loading}
            className="text-[11px] px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-40 text-left"
            style={{
              background: 'var(--bg-raised)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--sm-border)',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuery(query)}
          placeholder="Ask anything about deals, users, revenue, scraper health..."
          maxLength={500}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
          style={{
            background: 'var(--bg-raised)',
            color: 'var(--text-primary)',
            border: '1px solid var(--sm-border)',
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = 'var(--gold-border)')
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = 'var(--sm-border)')
          }
        />
        <button
          onClick={() => handleQuery(query)}
          disabled={loading || !query.trim()}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          style={{ background: 'var(--gold)' }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Send className="w-4 h-4 text-black" />
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Analysing your platform data…</span>
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="mt-4 space-y-3">
          <div
            className="p-4 rounded-xl text-sm leading-relaxed"
            style={{
              background: 'var(--bg-raised)',
              color: 'var(--text-primary)',
              border: '1px solid var(--sm-border)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.7,
            }}
          >
            {response}
          </div>

          {/* Data used toggle */}
          {dataUsed && (
            <div>
              <button
                onClick={() => setShowData((v) => !v)}
                className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                {showData ? '▲ Hide' : '▼ Show'} data snapshot used
              </button>
              {showData && (
                <pre
                  className="mt-2 p-3 rounded-lg text-[10px] overflow-x-auto"
                  style={{
                    background: '#0a0a0a',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--sm-border)',
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  {JSON.stringify(dataUsed, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mt-4 p-4 rounded-xl text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
