import { DealFeedSkeleton } from '@/components/deals/DealFeedSkeleton';

export default function Loading() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-800 animate-pulse" />
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-800 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-800 rounded" />
        </div>
      </div>

      <DealFeedSkeleton count={12} />
    </main>
  );
}
