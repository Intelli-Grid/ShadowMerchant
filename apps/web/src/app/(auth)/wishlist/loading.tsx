export default function WishlistLoading() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--bg-raised)' }} />
        <div className="h-4 w-56 rounded animate-pulse" style={{ background: 'var(--bg-raised)' }} />
      </div>

      {/* Deal card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
            {/* Image placeholder */}
            <div className="w-full h-44" style={{ background: 'var(--bg-raised)' }} />
            <div className="p-4">
              <div className="h-4 w-full rounded mb-2" style={{ background: 'var(--bg-raised)' }} />
              <div className="h-4 w-2/3 rounded mb-4" style={{ background: 'var(--bg-raised)' }} />
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 rounded" style={{ background: 'var(--bg-raised)' }} />
                <div className="h-5 w-12 rounded-full" style={{ background: 'var(--bg-raised)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
