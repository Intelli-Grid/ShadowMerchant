'use client';

import { useState, useTransition } from 'react';
import { DealCard } from './DealCard';
import { DealFeedSkeleton } from './DealFeedSkeleton';

interface Props {
  initialHasMore: boolean;
  searchParams: Record<string, string | undefined>;
}

export function LoadMoreDeals({ initialHasMore, searchParams }: Props) {
  const [extraDeals, setExtraDeals] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(2); // Initial page was 1 (server rendered)
  const [isPending, startTransition] = useTransition();

  async function loadMore() {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (searchParams.platform && searchParams.platform !== 'all') params.set('platform', searchParams.platform);
      if (searchParams.category && searchParams.category !== 'all') params.set('category', searchParams.category);
      if (searchParams.sort) params.set('sort', searchParams.sort === 'discount' ? 'discount' : searchParams.sort === 'newest' ? 'newest' : 'score');
      params.set('page', String(page));
      params.set('limit', '24');

      try {
        const res = await fetch(`/api/deals?${params.toString()}`);
        const data = await res.json();
        setExtraDeals(prev => [...prev, ...data.deals]);
        setHasMore(data.hasMore);
        setPage(p => p + 1);
      } catch {
        /* fail silently — user can retry */
      }
    });
  }

  if (extraDeals.length === 0 && !hasMore) return null;

  return (
    <>
      {/* Loaded extra deals */}
      {extraDeals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {extraDeals.map((deal) => (
            <DealCard key={deal._id || deal.deal_id} deal={deal} />
          ))}
        </div>
      )}

      {/* Skeleton while loading */}
      {isPending && (
        <div className="mt-6">
          <DealFeedSkeleton count={6} />
        </div>
      )}

      {/* Load More button */}
      {hasMore && !isPending && (
        <div className="flex justify-center mt-10">
          <button
            onClick={loadMore}
            className="btn-gold-outline px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
          >
            <span style={{ color: 'var(--gold)' }}>⬇</span> Load More Deals
          </button>
        </div>
      )}

      {/* End of results */}
      {!hasMore && extraDeals.length > 0 && (
        <p className="text-center text-sm mt-10 font-medium" style={{ color: 'var(--text-muted)' }}>
          ✓ All deals loaded — check back after the next scraper run.
        </p>
      )}
    </>
  );
}
