import { DealFeedSkeleton } from '@/components/deals/DealFeedSkeleton';

export default function Loading() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8 relative items-start">
        {/* Skeleton Sidebar */}
        <div className="w-64 h-96 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
        
        {/* Deal Feed Loading */}
        <section className="flex-1 min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-3">
              Live Feed
              <div className="w-20 h-6 rounded-full animate-pulse" style={{ background: 'var(--gold-dim)' }} />
            </h1>
          </div>
          <DealFeedSkeleton count={12} />
        </section>
      </div>
    </main>
  );
}
