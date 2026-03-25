import { NextRequest, NextResponse } from 'next/server';
import { searchClient, ALGOLIA_INDEX } from '@/lib/algolia';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ hits: [], nbHits: 0 });
  }

  try {
    const results = await searchClient.searchSingleIndex({
      indexName: ALGOLIA_INDEX,
      searchParams: {
        query,
        hitsPerPage: 20,
        attributesToRetrieve: [
          '_id', 'title', 'source_platform', 'original_price',
          'discounted_price', 'discount_percent', 'image_url',
          'affiliate_url', 'deal_score', 'category', 'brand',
        ],
        filters: 'is_active:true',
      },
    });

    return NextResponse.json({
      hits: results.hits,
      nbHits: results.nbHits,
      query,
    });
  } catch (err) {
    // Gracefully degrade — Algolia may not be configured in dev
    console.warn('[Search] Algolia error, falling back to empty results:', err);
    return NextResponse.json({ hits: [], nbHits: 0, error: 'Search unavailable' });
  }
}
