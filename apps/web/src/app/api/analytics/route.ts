import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Simple owner-only guard via secret header or env
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalDeals,
      activeDeals,
      topClicked,
      platformBreakdown,
      categoryBreakdown,
      dailyTrend,
      totalClicks,
    ] = await Promise.all([
      // Total deals in DB
      Deal.countDocuments(),
      // Active deals
      Deal.countDocuments({ is_active: true }),
      // Top 10 most clicked deals
      Deal.find({ is_active: true, click_count: { $gt: 0 } })
        .sort({ click_count: -1 })
        .limit(10)
        .select('title source_platform click_count deal_score discount_percent discounted_price')
        .lean(),
      // Clicks by platform
      Deal.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: '$source_platform', clicks: { $sum: '$click_count' }, count: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
      ]),
      // Clicks by category
      Deal.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: '$category', clicks: { $sum: '$click_count' }, count: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $limit: 8 },
      ]),
      // Daily click trend (last 7 days based on scraped_at as proxy)
      Deal.aggregate([
        { $match: { scraped_at: { $gte: last7 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$scraped_at' } },
            deals_added: { $sum: 1 },
            clicks: { $sum: '$click_count' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Total lifetime clicks
      Deal.aggregate([{ $group: { _id: null, total: { $sum: '$click_count' } } }]),
    ]);

    return NextResponse.json({
      overview: {
        total_deals: totalDeals,
        active_deals: activeDeals,
        total_clicks: totalClicks[0]?.total ?? 0,
      },
      top_clicked: topClicked,
      platform_breakdown: platformBreakdown,
      category_breakdown: categoryBreakdown,
      daily_trend: dailyTrend,
    });
  } catch (err) {
    console.error('[Analytics API]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
