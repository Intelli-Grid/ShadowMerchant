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
    // Algolia unavailable — fall back to MongoDB regex search so the
    // search bar always returns results for users.
    console.warn('[Search] Algolia error, falling back to MongoDB:', err);
    try {
      const { connectDB } = await import('@/lib/db');
      await connectDB();
      const DealModel = (await import('@/models/Deal')).default;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const deals = await DealModel.find({
        is_active: true,
        $or: [
          { title:    { $regex: escaped, $options: 'i' } },
          { brand:    { $regex: escaped, $options: 'i' } },
          { category: { $regex: escaped, $options: 'i' } },
        ],
      })
        .sort({ deal_score: -1 })
        .limit(20)
        .lean();

      return NextResponse.json({
        hits: JSON.parse(JSON.stringify(deals)),
        nbHits: deals.length,
        query,
        source: 'mongodb_fallback',
      });
    } catch (dbErr) {
      console.error('[Search] MongoDB fallback also failed:', dbErr);
      return NextResponse.json({ hits: [], nbHits: 0, error: 'Search unavailable' });
    }
  }
}

