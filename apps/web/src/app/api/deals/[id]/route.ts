import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis, ratelimit, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import Deal from '@/models/Deal';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // ── Rate limiting: 30 requests per minute per IP ──────────────────────────
  const ip = (req.headers as Headers).get('x-forwarded-for')?.split(',')[0].trim()
    ?? (req.headers as Headers).get('x-real-ip')
    ?? 'anon';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { id } = await params;

  // Serve from Redis cache if available (15-min TTL)
  const cacheKey = CACHE_KEYS.DEAL(id);
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  await connectDB();
  const deal = await Deal.findById(id).lean();
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const similar = await Deal.find({
    category: deal.category,
    _id: { $ne: deal._id },
    is_active: true,
  }).sort({ deal_score: -1 }).limit(6).lean();

  const result = { deal, price_history: deal.price_history, similar_deals: similar };
  await redis.set(cacheKey, result, { ex: CACHE_TTL.DEAL });

  return NextResponse.json(result);
}
