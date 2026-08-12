/**
 * Loading skeleton for the /pro upgrade page.
 * Shown while the server component resolves — the Pro page contains pricing,
 * feature lists and a Razorpay button that requires client-side hydration.
 */
export default function ProLoading() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white animate-pulse">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        {/* Badge */}
        <div className="h-7 w-28 bg-gray-800 rounded-full mx-auto mb-6" />
        {/* Headline */}
        <div className="h-12 w-3/4 bg-gray-800 rounded mx-auto mb-3" />
        <div className="h-12 w-1/2 bg-gray-800 rounded mx-auto mb-8" />
        {/* Subline */}
        <div className="h-5 w-2/3 bg-gray-700 rounded mx-auto mb-12" />

        {/* Feature list */}
        <div className="space-y-3 max-w-lg mx-auto mb-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 bg-orange-900/50 rounded-full flex-shrink-0" />
              <div className="h-5 flex-1 bg-gray-800 rounded" />
            </div>
          ))}
        </div>

        {/* Pricing card skeleton */}
        <div className="border border-orange-500/20 rounded-2xl p-8 max-w-sm mx-auto">
          <div className="h-10 w-24 bg-gray-800 rounded mx-auto mb-2" />
          <div className="h-4 w-20 bg-gray-700 rounded mx-auto mb-6" />
          <div className="h-14 w-full bg-orange-900/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
