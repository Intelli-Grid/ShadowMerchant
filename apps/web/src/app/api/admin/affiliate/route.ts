import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const [
    topClickedDeals,
    clicksByPlatform,
    recentClicks,
    highScoreNoClicks,
    totalClicksAllTime,
  ] = await Promise.all([
    // Top 20 deals by click count
    Deal.find(
      { is_active: true, click_count: { $gt: 0 } },
      { title: 1, click_count: 1, source_platform: 1, deal_score: 1, affiliate_url: 1, category: 1 }
    )
      .sort({ click_count: -1 })
      .limit(20)
      .lean(),

    // Click distribution by platform
    Deal.aggregate([
      { $match: { click_count: { $gt: 0 } } },
      {
        $group: {
          _id: '$source_platform',
          totalClicks: { $sum: '$click_count' },
          dealCount:   { $sum: 1 },
          avgScore:    { $avg: '$deal_score' },
        },
      },
      { $sort: { totalClicks: -1 } },
    ]),

    // Clicks in last 24h (using last_clicked_at if available)
    Deal.countDocuments({
      last_clicked_at: { $gte: new Date(Date.now() - 86400000) },
    }).catch(() => 0),

    // High-score deals with zero clicks — missed promotion opportunities
    Deal.find(
      {
        is_active: true,
        deal_score: { $gte: 75 },
        $or: [{ click_count: 0 }, { click_count: null }],
      },
      { title: 1, deal_score: 1, source_platform: 1, category: 1 }
    )
      .sort({ deal_score: -1 })
      .limit(10)
      .lean(),

    // Aggregate total clicks
    Deal.aggregate([
      { $group: { _id: null, total: { $sum: '$click_count' } } },
    ]),
  ]);

  return NextResponse.json({
    topClickedDeals,
    clicksByPlatform,
    recentClicksLast24h: recentClicks,
    highScoreNoClicks,
    totalClicksAllTime: totalClicksAllTime[0]?.total || 0,
    note: 'For actual affiliate revenue (₹), connect Amazon Associates API + Flipkart Affiliate API.',
    generatedAt: new Date().toISOString(),
  });
}
