export function DealFeedSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex flex-col rounded-xl border border-gray-800 bg-[#0d0d12] overflow-hidden">
          {/* Image skeleton */}
          <div className="h-48 bg-gray-900 w-full" />
          {/* Content skeleton */}
          <div className="p-4 flex flex-col gap-3">
            {/* Title */}
            <div className="h-5 bg-gray-900 rounded w-full" />
            <div className="h-5 bg-gray-900 rounded w-3/4" />
            {/* Price */}
            <div className="flex gap-2 items-center mt-2">
              <div className="h-6 bg-gray-900 rounded w-20" />
              <div className="h-4 bg-gray-900 rounded w-16" />
            </div>
            {/* Footer */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-900">
              <div className="h-8 bg-gray-900 rounded w-24" />
              <div className="h-8 bg-gray-900 rounded w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
