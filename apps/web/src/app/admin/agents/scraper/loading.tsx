// G2: Streaming skeleton shown while the Scraper Agent server component fetches data
export default function ScraperLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="h-10 w-36 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>

      {/* Log table skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
        <div className="h-12 px-6 flex items-center" style={{ borderBottom: '1px solid var(--sm-border)' }}>
          <div className="h-4 w-32 rounded" style={{ background: 'var(--bg-raised)' }} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 px-6 flex items-center gap-4" style={{ borderBottom: '1px solid var(--sm-border)' }}>
            <div className="h-3 w-20 rounded" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-3 w-32 rounded" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-3 w-16 rounded ml-auto" style={{ background: 'var(--bg-raised)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
