export default function AlertsLoading() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-40 rounded-lg animate-pulse mb-2" style={{ background: 'var(--bg-raised)' }} />
        <div className="h-4 w-64 rounded animate-pulse" style={{ background: 'var(--bg-raised)' }} />
      </div>

      {/* Alert preference cards skeleton */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--bg-raised)' }} />
                <div>
                  <div className="h-4 w-32 rounded mb-2" style={{ background: 'var(--bg-raised)' }} />
                  <div className="h-3 w-48 rounded" style={{ background: 'var(--bg-raised)' }} />
                </div>
              </div>
              <div className="w-12 h-6 rounded-full" style={{ background: 'var(--bg-raised)' }} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
