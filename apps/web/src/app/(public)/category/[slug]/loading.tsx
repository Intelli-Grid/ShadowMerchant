import { DealFeedSkeleton } from '@/components/deals/DealFeedSkeleton';

export default function Loading() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 animate-pulse">
        <div className="h-4 w-32 bg-gray-800 rounded mb-3" />
        <div className="h-8 w-64 bg-gray-800 rounded" />
        <div className="h-4 w-48 bg-gray-800 rounded mt-2" />
      </div>

      <DealFeedSkeleton count={12} />
    </main>
  );
}
