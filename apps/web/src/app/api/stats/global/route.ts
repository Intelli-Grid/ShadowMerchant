import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

export async function GET() {
  try {
    await connectDB();

    const aggregationResult = await Deal.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: null,
          totalSavings: {
            $sum: { $subtract: ['$original_price', '$discounted_price'] }
          },
          dealCount: { $sum: 1 }
        }
      }
    ]);

    const totalSavings = aggregationResult[0]?.totalSavings ?? 0;
    const dealCount    = aggregationResult[0]?.dealCount    ?? 0;

    return NextResponse.json(
      { success: true, totalSavings, dealCount },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[/api/stats/global]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
