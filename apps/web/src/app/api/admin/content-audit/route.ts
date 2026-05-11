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
    suspectDiscounts,
    meeshoInflated,
    shortTitles,
    missingImages,
    lowScoreTrending,
    dominatedCategories,
  ] = await Promise.all([
    // Deals with potentially inflated MRP (>85% discount)
    Deal.find(
      { is_active: true, discount_percent: { $gt: 85 } },
      { title: 1, discount_percent: 1, original_price: 1, discounted_price: 1, source_platform: 1, deal_score: 1 }
    )
      .sort({ discount_percent: -1 })
      .limit(20)
      .lean(),

    // Meesho deals with original_price more than 2.5x the sale price
    Deal.find(
      {
        is_active: true,
        source_platform: 'meesho',
        $expr: { $gt: ['$original_price', { $multiply: ['$discounted_price', 2.5] }] },
      },
      { title: 1, original_price: 1, discounted_price: 1, discount_percent: 1, deal_score: 1 }
    )
      .sort({ discount_percent: -1 })
      .limit(20)
      .lean(),

    // Deals with very short titles (<15 chars)
    Deal.find(
      { is_active: true, $expr: { $lt: [{ $strLenCP: '$title' }, 15] } },
      { title: 1, source_platform: 1, deal_score: 1 }
    )
      .limit(20)
      .lean(),

    // Deals with no image
    Deal.find(
      { is_active: true, $or: [{ image_url: '' }, { image_url: null }] },
      { title: 1, source_platform: 1, deal_score: 1 }
    )
      .limit(20)
      .lean(),

    // Trending deals with score < 50 (should not be trending)
    Deal.find(
      { is_active: true, is_trending: true, deal_score: { $lt: 50 } },
      { title: 1, deal_score: 1, source_platform: 1 }
    )
      .lean(),

    // Categories dominated >75% by a single platform
    Deal.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: { category: '$category', platform: '$source_platform' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.category',
          platforms: { $push: { platform: '$_id.platform', count: '$count' } },
          total: { $sum: '$count' },
        },
      },
      {
        $project: {
          platforms: 1,
          total: 1,
          maxShare: {
            $max: {
              $map: {
                input: '$platforms',
                as: 'p',
                in: { $divide: ['$$p.count', '$total'] },
              },
            },
          },
        },
      },
      { $match: { maxShare: { $gt: 0.75 } } },
      { $sort: { maxShare: -1 } },
    ]),
  ]);

  return NextResponse.json({
    suspectDiscounts,
    meeshoInflated,
    shortTitles,
    missingImages,
    lowScoreTrending,
    dominatedCategories,
    auditedAt: new Date().toISOString(),
  });
}
