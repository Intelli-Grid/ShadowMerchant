import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

const CATEGORIES = [
  { slug: 'electronics', emoji: '💻', title: 'Top Electronics' },
  { slug: 'fashion', emoji: '👗', title: 'Trending Fashion' },
  { slug: 'beauty', emoji: '💄', title: 'Beauty & Grooming' },
  { slug: 'home', emoji: '🏠', title: 'Home & Kitchen' },
];

// Helper to reliably round-robin interleave arrays from different platforms
function roundRobinInterleave<T>(groups: Record<string, T[]>): T[] {
  const result: T[] = [];
  const platforms = Object.keys(groups);
  const maxLen = Math.max(...platforms.map(p => groups[p].length));
  
  for (let i = 0; i < maxLen; i++) {
    for (const p of platforms) {
      if (groups[p][i]) {
        result.push(groups[p][i]);
      }
    }
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platformFilter = searchParams.get('platform'); // optional

    await connectDB();

    const feedData = [];

    for (const cat of CATEGORIES) {
      const query: any = { is_active: true, is_pro_exclusive: false };
      
      // MED-04 fix: use exact slug match instead of unanchored $regex so MongoDB
      // can use the compound index on `category`. Scrapers normalize to these slugs.
      query.category = cat.slug;

      if (platformFilter) {
        query.source_platform = platformFilter;
      }

      // Fetch deals for the category
      const rawDeals = await Deal.find(query)
        .sort({ deal_score: -1 })
        .limit(20)
        .lean();

      if (rawDeals.length > 0) {
        // Group by platform so we can interleave
        const groups: Record<string, any[]> = {};
        for (const deal of rawDeals) {
          const p = deal.source_platform || 'unknown';
          if (!groups[p]) groups[p] = [];
          groups[p].push(deal);
        }

        const interleaved = roundRobinInterleave(groups);

        feedData.push({
          categorySlug: cat.slug,
          emoji: cat.emoji,
          title: cat.title,
          totalDeals: rawDeals.length,
          deals: interleaved.slice(0, 10), // Limit to 10 for the swimlane
        });
      }
    }

    return NextResponse.json({ success: true, feed: feedData });
  } catch (error: any) {
    console.error('Error in /api/deals/category-feed:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
