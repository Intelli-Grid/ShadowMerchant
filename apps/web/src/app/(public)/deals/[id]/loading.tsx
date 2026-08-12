/**
 * Loading skeleton for the deal detail page.
 * Shown by Next.js Suspense while the async page.tsx component is fetching deal data.
 * Without this, users see a blank white page on slow connections, which kills engagement.
 */
export default function DealLoading() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-4 w-20 bg-gray-800 rounded" />
          <div className="h-4 w-4 bg-gray-800 rounded" />
          <div className="h-4 w-32 bg-gray-800 rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image skeleton */}
          <div className="aspect-square bg-gray-800 rounded-2xl" />

          {/* Info skeleton */}
          <div className="space-y-4">
            {/* Platform badge */}
            <div className="h-6 w-24 bg-gray-800 rounded-full" />
            {/* Title */}
            <div className="h-8 w-full bg-gray-800 rounded" />
            <div className="h-8 w-3/4 bg-gray-800 rounded" />
            {/* Price */}
            <div className="h-12 w-48 bg-gray-800 rounded" />
            <div className="h-5 w-32 bg-gray-800 rounded" />
            {/* Score bar */}
            <div className="h-16 bg-gray-800 rounded-xl" />
            {/* CTA */}
            <div className="h-14 w-full bg-orange-900/30 rounded-xl" />
            {/* Action row */}
            <div className="flex gap-3">
              <div className="h-10 w-32 bg-gray-800 rounded-lg" />
              <div className="h-10 w-32 bg-gray-800 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Price history skeleton */}
        <div className="mt-10 h-48 bg-gray-800 rounded-2xl" />

        {/* Similar deals skeleton */}
        <div className="mt-10">
          <div className="h-6 w-40 bg-gray-800 rounded mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
