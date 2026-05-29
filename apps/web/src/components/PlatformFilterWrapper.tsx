'use client';

/**
 * PlatformFilterWrapper — thin Client Component that loads PlatformFilter
 * dynamically with ssr:false.
 *
 * Why: PlatformFilter calls useSearchParams(), which causes Next.js/Turbopack
 * to bail out of static prerendering for any Server Component page that
 * imports it directly (even with <Suspense>).
 *
 * next/dynamic with ssr:false CANNOT be used directly in a Server Component,
 * so this wrapper file (marked 'use client') acts as the boundary.
 * The Server Component (deals/feed/page.tsx) imports this wrapper, which is
 * safe, and the actual filter loads on the client only.
 */
import dynamic from 'next/dynamic';

const PlatformFilterDynamic = dynamic(
  () => import('@/components/PlatformFilter').then((m) => m.PlatformFilter),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[65px] w-full"
        style={{
          background: 'rgba(10,10,11,0.85)',
          borderBottom: '1px solid var(--sm-border)',
        }}
      />
    ),
  }
);

export function PlatformFilterWrapper() {
  return <PlatformFilterDynamic />;
}
