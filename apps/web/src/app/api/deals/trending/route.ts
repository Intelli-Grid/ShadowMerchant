import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import Deal from '@/models/Deal';

export async function GET() {
  const cached = await redis.get(CACHE_KEYS.TRENDING_DEALS);
  if (cached) return NextResponse.json(cached);

  await connectDB();

  // Use is_trending flag — set by pipeline after each run (top 10 by deal_score)
  const deals = await Deal.find({ is_active: true, is_trending: true })
    .sort({ deal_score: -1 })
    .limit(10)
    .lean();

  await redis.set(CACHE_KEYS.TRENDING_DEALS, deals, { ex: CACHE_TTL.TRENDING });
  return NextResponse.json(deals);
}
