import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const now = new Date();
  const last7d  = new Date(now.getTime() - 7  * 86400000);
  const last30d = new Date(now.getTime() - 30 * 86400000);

  const [
    // User growth
    usersTotal,
    usersLast7d,
    usersLast30d,
    proLast30d,
    userGrowthDaily,

    // Deal catalog growth
    dealsLast7d,
    dealsLast30d,
    dealsGrowthDaily,

    // Category depth
    categoryStats,

    // Top performing categories by click engagement
    topClickCategories,

    // High click velocity deals (potential viral picks)
    velocityDeals,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ created_at: { $gte: last7d } }),
    User.countDocuments({ created_at: { $gte: last30d } }),
    User.countDocuments({ subscription_tier: 'pro', created_at: { $gte: last30d } }),

    // Daily new user signups for last 14 days
    User.aggregate([
      { $match: { created_at: { $gte: new Date(now.getTime() - 14 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Deal.countDocuments({ scraped_at: { $gte: last7d }, is_active: true }),
    Deal.countDocuments({ scraped_at: { $gte: last30d }, is_active: true }),

    // Daily new deals added for last 14 days
    Deal.aggregate([
      { $match: { scraped_at: { $gte: new Date(now.getTime() - 14 * 86400000) }, is_active: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scraped_at' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Category depth
    Deal.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: '$category',
          count:    { $sum: 1 },
          avgScore: { $avg: '$deal_score' },
          avgDiscount: { $avg: '$discount_percent' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),

    // Categories with most clicks
    Deal.aggregate([
      { $match: { is_active: true, click_count: { $gt: 0 } } },
      {
        $group: {
          _id: '$category',
          totalClicks: { $sum: '$click_count' },
          dealCount:   { $sum: 1 },
          avgScore:    { $avg: '$deal_score' },
        },
      },
      { $sort: { totalClicks: -1 } },
      { $limit: 10 },
    ]),

    // High click velocity — velocity_score written by scheduler.py
    Deal.find(
      { is_active: true, velocity_score: { $gt: 0 } },
      { title: 1, velocity_score: 1, click_count: 1, deal_score: 1, source_platform: 1, category: 1 }
    )
      .sort({ velocity_score: -1 })
      .limit(8)
      .lean(),
  ]);

  return NextResponse.json({
    users: {
      total: usersTotal,
      last7d: usersLast7d,
      last30d: usersLast30d,
      proLast30d,
      growthRate7d: usersTotal > 0 ? `${((usersLast7d / usersTotal) * 100).toFixed(1)}%` : '0%',
      dailyBreakdown: userGrowthDaily,
    },
    deals: {
      last7d: dealsLast7d,
      last30d: dealsLast30d,
      dailyBreakdown: dealsGrowthDaily,
    },
    categories: categoryStats,
    topClickCategories,
    velocityDeals,
    generatedAt: now.toISOString(),
  });
}
