// G2: Streaming skeleton shown while the Growth Agent server component fetches data
export default function GrowthLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="h-6 w-32 rounded-full" style={{ background: 'var(--bg-surface)' }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>

      {/* Funnel / chart skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-56 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }} />
        <div className="h-56 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }} />
      </div>

      {/* Churn rows */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
        <div className="h-12 px-6 flex items-center" style={{ borderBottom: '1px solid var(--sm-border)' }}>
          <div className="h-4 w-44 rounded" style={{ background: 'var(--bg-raised)' }} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 px-6 flex items-center gap-4" style={{ borderBottom: '1px solid var(--sm-border)' }}>
            <div className="h-8 w-8 rounded-full" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-3 w-36 rounded" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-8 w-24 rounded-xl ml-auto" style={{ background: 'var(--bg-raised)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
