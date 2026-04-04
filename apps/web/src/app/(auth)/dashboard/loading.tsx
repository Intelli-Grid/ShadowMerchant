export default function DashboardLoading() {
  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--bg-raised)' }} />
        <div className="h-4 w-72 rounded animate-pulse" style={{ background: 'var(--bg-raised)' }} />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
            <div className="h-7 w-16 rounded mb-2" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-raised)' }} />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-xl p-6 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
        <div className="h-5 w-40 rounded mb-6" style={{ background: 'var(--bg-raised)' }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b last:border-0" style={{ borderColor: 'var(--sm-border)' }}>
            <div className="w-12 h-12 rounded-xl flex-shrink-0 animate-pulse" style={{ background: 'var(--bg-raised)' }} />
            <div className="flex-1">
              <div className="h-4 w-3/4 rounded mb-2" style={{ background: 'var(--bg-raised)' }} />
              <div className="h-3 w-1/2 rounded" style={{ background: 'var(--bg-raised)' }} />
            </div>
            <div className="h-8 w-20 rounded-full" style={{ background: 'var(--bg-raised)' }} />
          </div>
        ))}
      </div>
    </main>
  );
}
