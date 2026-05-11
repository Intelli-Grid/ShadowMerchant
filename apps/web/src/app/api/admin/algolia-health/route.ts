import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import { adminClient, ALGOLIA_INDEX } from '@/lib/algolia.server';

export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();
  const mongoActiveDeals = await Deal.countDocuments({ is_active: true });

  if (!adminClient) {
    return NextResponse.json({
      mongoActiveDeals,
      algoliaAvailable: false,
      note: 'ALGOLIA_ADMIN_KEY not configured — index health check skipped.',
    });
  }

  try {
    // Run 5 representative search quality tests
    const testQueries = ['phone', 'earbuds', 'laptop', 'dress', 'moisturiser'];
    const searchResults = await Promise.all(
      testQueries.map(async (q) => {
        try {
          const result = await adminClient!.searchSingleIndex({
            indexName: ALGOLIA_INDEX,
            searchParams: { query: q, hitsPerPage: 1, filters: 'is_active:true' },
          });
          return { query: q, nbHits: result.nbHits };
        } catch {
          return { query: q, nbHits: -1, error: true };
        }
      })
    );

    // Get index settings
    let indexSettings: any = {};
    try {
      indexSettings = await adminClient!.getSettings({ indexName: ALGOLIA_INDEX });
    } catch { /* ignore */ }

    return NextResponse.json({
      mongoActiveDeals,
      algoliaAvailable: true,
      searchTests: searchResults,
      indexSettings: {
        attributesForFaceting: indexSettings.attributesForFaceting || [],
        searchableAttributes: indexSettings.searchableAttributes || [],
        customRanking: indexSettings.customRanking || [],
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, mongoActiveDeals }, { status: 500 });
  }
}
