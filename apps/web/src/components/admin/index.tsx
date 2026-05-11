'use client';

// ════════════════════════════════════════════════════════════════════════════
// ShadowMerchant Admin — Shared UI Components
// Used across all admin agent pages
// ════════════════════════════════════════════════════════════════════════════

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'gold' | 'green' | 'blue' | 'amber' | 'red';
  icon?: React.ReactNode;
}

export function KPICard({ label, value, sub, accent = 'gold', icon }: KPICardProps) {
  const colors = {
    gold:  { bg: 'rgba(201,168,76,0.08)',  text: '#C9A84C', border: 'rgba(201,168,76,0.2)'  },
    green: { bg: 'rgba(34,197,94,0.08)',   text: '#22c55e', border: 'rgba(34,197,94,0.2)'   },
    blue:  { bg: 'rgba(59,130,246,0.08)',  text: '#60a5fa', border: 'rgba(59,130,246,0.2)'  },
    amber: { bg: 'rgba(245,158,11,0.08)',  text: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
    red:   { bg: 'rgba(239,68,68,0.08)',   text: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
  };
  const c = colors[accent];

  return (
    <div
      className="rounded-xl p-4 transition-all hover:scale-[1.02]"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </p>
        {icon && <span style={{ color: c.text, opacity: 0.7 }}>{icon}</span>}
      </div>
      <p
        className="text-2xl font-black"
        style={{ color: c.text, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
export function StatusPill({ label, healthy }: { label: string; healthy: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
      style={{
        background: healthy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        color: healthy ? '#22c55e' : '#ef4444',
        border: `1px solid ${healthy ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: healthy ? '#22c55e' : '#ef4444' }}
      />
      {label}
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        style={{
          width: 3,
          height: 20,
          background: 'linear-gradient(to bottom, var(--gold-bright), var(--gold))',
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <div>
        <h2
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {title}
        </h2>
        {sub && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Admin Card (surface wrapper) ──────────────────────────────────────────────
export function AdminCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--sm-border)',
      }}
    >
      {children}
    </div>
  );
}

// ── Platform Row ──────────────────────────────────────────────────────────────
const PLATFORM_EMOJIS: Record<string, string> = {
  amazon: '📦',
  flipkart: '🛒',
  meesho: '🛍️',
  myntra: '👗',
  nykaa: '💄',
  croma: '🔌',
  tatacliq: '🏷️',
};

export function PlatformRow({
  platform,
  count,
  avgScore,
  total,
}: {
  platform: string;
  count: number;
  avgScore: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const scoreColor =
    avgScore >= 60 ? '#22c55e' : avgScore >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
          {PLATFORM_EMOJIS[platform] || '🏪'} {platform}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {count.toLocaleString('en-IN')} deals
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: `${scoreColor}18`,
              color: scoreColor,
            }}
          >
            avg {Math.round(avgScore)}/100
          </span>
        </div>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-raised)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background:
              pct > 60
                ? 'linear-gradient(90deg, var(--gold), #f59e0b)'
                : 'var(--gold)',
          }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {pct}% of catalog
        </span>
      </div>
    </div>
  );
}

// ── Scrape Log Row ────────────────────────────────────────────────────────────
export function ScrapeLogRow({ log }: { log: any }) {
  const statusColors: Record<string, string> = {
    success: '#22c55e',
    failed: '#ef4444',
    partial: '#f59e0b',
    running: '#60a5fa',
    triggered_manually: 'var(--gold)',
  };
  const statusColor = statusColors[log.status] || 'var(--text-muted)';

  const hoursAgo = log.started_at
    ? Math.round((Date.now() - new Date(log.started_at).getTime()) / 3600000)
    : null;
  const timeLabel =
    hoursAgo !== null
      ? hoursAgo < 1
        ? 'just now'
        : `${hoursAgo}h ago`
      : 'unknown';

  const dealsAdded = log.total_deals_inserted ?? log.deals_scraped ?? 0;

  return (
    <div
      className="flex items-center justify-between py-2.5 border-b"
      style={{ borderColor: 'var(--sm-border)' }}
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
          {log.scrapers_run?.join(', ') || log.platform || 'all platforms'}
        </span>
        <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>
          {dealsAdded > 0 ? `+${dealsAdded} new` : '—'} · {timeLabel}
        </span>
      </div>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded ml-3 shrink-0"
        style={{ background: `${statusColor}18`, color: statusColor }}
      >
        {log.status}
      </span>
    </div>
  );
}

// ── Score Distribution Chart ──────────────────────────────────────────────────
export function ScoreDistributionChart({ data }: { data: any[] }) {
  const maxCount = Math.max(...data.map((d) => d.count ?? 0), 1);
  const labels = ['0–19', '20–39', '40–59', '60–79', '80–100'];
  const barColors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#C9A84C'];

  return (
    <div className="space-y-2.5">
      {data.map((bucket: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="text-[10px] w-12 text-right shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {labels[i] ?? String(bucket._id)}
          </span>
          <div
            className="flex-1 h-5 rounded overflow-hidden"
            style={{ background: 'var(--bg-raised)' }}
          >
            <div
              className="h-full rounded flex items-center px-1.5 text-[9px] font-bold text-black transition-all duration-700"
              style={{
                width: `${Math.max(((bucket.count ?? 0) / maxCount) * 100, 4)}%`,
                background: barColors[i] || '#888',
              }}
            >
              {bucket.count ?? 0}
            </div>
          </div>
        </div>
      ))}
      <p className="text-[9px] mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Healthy: most deals in 40–79 range. 80+ should be rare (&lt;10%).
      </p>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({
  children,
  color = 'gold',
}: {
  children: React.ReactNode;
  color?: 'gold' | 'green' | 'red' | 'blue' | 'amber';
}) {
  const colors = {
    gold:  { bg: 'rgba(201,168,76,0.12)',  text: '#C9A84C', border: 'rgba(201,168,76,0.3)'  },
    green: { bg: 'rgba(34,197,94,0.12)',   text: '#22c55e', border: 'rgba(34,197,94,0.3)'   },
    red:   { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)'   },
    blue:  { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },
    amber: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)'  },
  };
  const c = colors[color];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {children}
    </span>
  );
}

// ── Action Button ─────────────────────────────────────────────────────────────
export function ActionButton({
  children,
  onClick,
  loading = false,
  variant = 'gold',
  disabled = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  variant?: 'gold' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    gold: {
      background: 'var(--gold)',
      color: '#0A0A0A',
      border: 'none',
    },
    danger: {
      background: 'rgba(239,68,68,0.12)',
      color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.3)',
    },
    ghost: {
      background: 'var(--bg-raised)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--sm-border)',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={styles[variant]}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          Loading…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
