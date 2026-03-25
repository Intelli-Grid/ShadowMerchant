import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis } from '@/lib/redis';
import Deal from '@/models/Deal';

export async function GET() {
  // Try cache first
  const cached = await redis.get('categories:all');
  if (cached) return NextResponse.json(cached);

  await connectDB();

  const categories = await Deal.aggregate([
    { $match: { is_active: true } },
    { $group: { _id: '$category', count: { $sum: 1 }, avg_discount: { $avg: '$discount_percent' } } },
    { $sort: { count: -1 } },
    { $project: { category: '$_id', count: 1, avg_discount: { $round: ['$avg_discount', 0] }, _id: 0 } },
  ]);

  await redis.set('categories:all', categories, { ex: 3600 });
  return NextResponse.json(categories);
}
