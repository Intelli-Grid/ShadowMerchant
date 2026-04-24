import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis, CACHE_KEYS, CACHE_TTL, ratelimit } from '@/lib/redis';
import Deal from '@/models/Deal';

export async function GET(req: NextRequest) {
  // Rate limit: 30 req/min per IP — prevents catalog scraping of the trending feed
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon';
  const { success } = await ratelimit.limit(`trending:${ip}`);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const cached = await redis.get(CACHE_KEYS.TRENDING_DEALS);
  if (cached) return NextResponse.json(cached);

  await connectDB();

  // Use is_trending flag — set by pipeline after each run (top 10 by composite score)
  const deals = await Deal.find({ is_active: true, is_trending: true })
    .sort({ deal_score: -1 })
    .limit(10)
    .lean();

  await redis.set(CACHE_KEYS.TRENDING_DEALS, deals, { ex: CACHE_TTL.TRENDING });
  return NextResponse.json(deals);
}
