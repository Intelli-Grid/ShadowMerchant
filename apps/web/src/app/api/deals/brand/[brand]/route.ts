import { NextRequest, NextResponse } from 'next/server';
import { ratelimit } from '@/lib/redis';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

/**
 * GET /api/deals/brand/[brand]
 *
 * Returns paginated active deals for a specific brand, sorted by deal_score.
 * Rate-limited (reuses existing ratelimit instance).
 * Used by future client-side paginated brand pages.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string }> }
) {
  const { brand } = await params;

  if (!brand || brand.trim().length === 0) {
    return NextResponse.json({ error: 'brand is required' }, { status: 400 });
  }

  // Rate limit: 30 req/min per IP — same as the main deals feed
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const rawPage  = Number(req.nextUrl.searchParams.get('page')  || 1);
  const rawLimit = Number(req.nextUrl.searchParams.get('limit') || 24);
  const page     = Math.min(100, Math.max(1, isNaN(rawPage)  ? 1  : rawPage));
  const limit    = Math.min(48,  Math.max(1, isNaN(rawLimit) ? 24 : rawLimit));

  // Case-insensitive exact match — not substring
  const regex = new RegExp(
    `^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i'
  );
  const query = { brand: regex, is_active: true };

  await connectDB();

  const [deals, total] = await Promise.all([
    Deal.find(query)
      .select({
        title: 1, discounted_price: 1, original_price: 1,
        discount_percent: 1, deal_score: 1, source_platform: 1,
        category: 1, affiliate_url: 1, image_url: 1,
        is_pro_exclusive: 1, scraped_at: 1, tags: 1,
      })
      .sort({ deal_score: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Deal.countDocuments(query),
  ]);

  return NextResponse.json({
    deals,
    total,
    page,
    hasMore: page * limit < total,
  });
}
