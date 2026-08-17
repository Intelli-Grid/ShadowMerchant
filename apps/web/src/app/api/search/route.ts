import { NextRequest, NextResponse } from 'next/server';
import { searchClient, ALGOLIA_INDEX } from '@/lib/algolia';
import { ratelimitSearch } from '@/lib/redis';

export async function GET(req: NextRequest) {
  // ── Rate limiting: 10 requests per minute per IP (stricter — prevent enumeration) ──
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'anon';
  const { success } = await ratelimitSearch.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const query = req.nextUrl.searchParams.get('q');
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ hits: [], nbHits: 0 });
  }

  try {
    if (!searchClient) throw new Error('Algolia not configured');
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

      const laptopData = (await import('@/data/laptop_reports_data.json')).default;
      const phoneData = (await import('@/data/smartphone_reports_data.json')).default;
      const monitorData = (await import('@/data/monitor_reports_data.json')).default;
      const audioData = (await import('@/data/audio_reports_data.json')).default;
      const watchData = (await import('@/data/smartwatch_reports_data.json')).default;
      const applianceData = (await import('@/data/appliance_reports_data.json')).default;
      const consoleData = (await import('@/data/console_reports_data.json')).default;

      const qLower = query.toLowerCase();
      const reportHits: any[] = [];

      const searchReports = (items: any[], category: string) => {
        items.forEach((item) => {
          if (item.title.toLowerCase().includes(qLower)) {
            reportHits.push({
              _id: `report-${category}-${item.id}`,
              title: `[Report] ${item.title}`,
              source_platform: item.platform,
              original_price: item.original_price,
              discounted_price: item.current_price,
              discount_percent: Math.round(((item.original_price - item.current_price) / item.original_price) * 100),
              affiliate_url: `/reports/${category}/${item.slug}`,
              is_report: true,
              deal_score: 95,
              category,
            });
          }
        });
      };

      searchReports(laptopData, 'laptops');
      searchReports(phoneData, 'smartphones');
      searchReports(monitorData, 'monitors');
      searchReports(audioData, 'audio');
      searchReports(watchData, 'smartwatches');
      searchReports(applianceData, 'appliances');
      searchReports(consoleData, 'consoles');

      return NextResponse.json({
        hits: [...reportHits.slice(0, 10), ...JSON.parse(JSON.stringify(deals)).slice(0, 10)],
        nbHits: reportHits.length + deals.length,
        query,
        source: 'mongodb_reports_fallback',
      });
    } catch (dbErr) {
      console.error('[Search] Fallback failed:', dbErr);
      return NextResponse.json({ hits: [], nbHits: 0, error: 'Search unavailable' });
    }
  }
}

