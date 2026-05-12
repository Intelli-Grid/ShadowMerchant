// G2: Streaming skeleton shown while the Content Agent server component fetches data
export default function ContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-52 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="h-10 w-40 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>

      {/* Audit results skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
        <div className="h-12 px-6 flex items-center" style={{ borderBottom: '1px solid var(--sm-border)' }}>
          <div className="h-4 w-40 rounded" style={{ background: 'var(--bg-raised)' }} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 px-6 flex items-center gap-4" style={{ borderBottom: '1px solid var(--sm-border)' }}>
            <div className="h-3 w-48 rounded" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-5 w-16 rounded-full ml-auto" style={{ background: 'var(--bg-raised)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
