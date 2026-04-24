import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis, ratelimit, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import Deal from '@/models/Deal';

export async function GET(req: NextRequest) {
  // ── Rate limiting: 30 requests per minute per IP ──────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'anon';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const params = req.nextUrl.searchParams;
  const platform = params.get('platform');
  const category = params.get('category');
  const min_discount = Number(params.get('min_discount') || 0);
  const max_price = Number(params.get('max_price') || 999999);
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);
  const limit = Number(params.get('limit') || 20);
  const pro_only = params.get('pro_only') === 'true';

  const cacheKey = CACHE_KEYS.DEAL_LIST(params.toString());
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  await connectDB();

  const query: any = {
    is_active: true,
    discount_percent: { $gte: min_discount },
    discounted_price: { $lte: max_price },
  };
  if (platform) query.source_platform = platform;
  if (category) query.category = category;
  if (pro_only) query.is_pro_exclusive = true;

  const sortMap: Record<string, any> = {
    newest: { scraped_at: -1 },
    discount: { discount_percent: -1 },
    score: { deal_score: -1 },
  };

  const VALID_SORT = ['newest', 'discount', 'score'] as const;
  const safeSortKey = VALID_SORT.includes(sort as any) ? (sort as typeof VALID_SORT[number]) : 'score';

  const [deals, total] = await Promise.all([
    Deal.find(query).sort(sortMap[safeSortKey]).skip((page - 1) * limit).limit(limit).lean(),
    Deal.countDocuments(query),
  ]);

  const result = { deals, total, page, hasMore: page * limit < total };
  await redis.set(cacheKey, result, { ex: CACHE_TTL.DEAL_LIST });
  return NextResponse.json(result);
}
