import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis, ratelimit, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import Deal from '@/models/Deal';

// ─── Provider diversity cap ────────────────────────────────────────────────
// On homepage feeds (no platform/category filter, sorted by score), we enforce
// a maximum of 40% deals from any single store. This prevents Nykaa (or any
// single working scraper) from monopolising the entire homepage.
const MAX_STORE_FRACTION = 0.40;

function applyDiversityCap(deals: any[], limit: number): {
  diversified: any[];
  activePlatforms: string[];
  singleSourceWarning: string | null;
} {
  if (deals.length === 0) {
    return { diversified: [], activePlatforms: [], singleSourceWarning: null };
  }

  // Group by platform
  const byPlatform: Record<string, any[]> = {};
  for (const deal of deals) {
    const p = deal.source_platform || 'unknown';
    if (!byPlatform[p]) byPlatform[p] = [];
    byPlatform[p].push(deal);
  }

  const activePlatforms = Object.keys(byPlatform);
  const platformCap    = Math.max(1, Math.ceil(limit * MAX_STORE_FRACTION));
  const counters: Record<string, number> = {};
  const diversified: any[] = [];

  // Round-robin fill up to cap per platform
  let progress = true;
  while (diversified.length < limit && progress) {
    progress = false;
    for (const platform of activePlatforms) {
      if (diversified.length >= limit) break;
      const used = counters[platform] ?? 0;
      if (used >= platformCap) continue;
      const next = byPlatform[platform][used];
      if (next) {
        diversified.push(next);
        counters[platform] = used + 1;
        progress = true;
      }
    }
  }

  // If we couldn't fill the cap from 3+ stores, warn the UI
  const platformsWithDeals = activePlatforms.filter(
    p => (counters[p] ?? 0) > 0
  );
  const singleSourceWarning =
    platformsWithDeals.length < 3
      ? `Showing ${platformsWithDeals.join(', ')} deals — other feeds updating`
      : null;

  return { diversified, activePlatforms: platformsWithDeals, singleSourceWarning };
}

// ── PERF-01: Only fetch fields needed for deal cards — saves bandwidth ──────
// Full description, price_history etc. are loaded on the detail page.
const FEED_PROJECTION = {
  title:            1,
  discounted_price: 1,
  original_price:   1,
  discount_percent: 1,
  deal_score:       1,
  source_platform:  1,
  category:         1,
  affiliate_url:    1,
  image_url:        1,
  is_pro_exclusive: 1,
  scraped_at:       1,
  tags:             1,
} as const;

export async function GET(req: NextRequest) {
  // ── Rate limiting: 30 requests per minute per IP ─────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anon';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const params       = req.nextUrl.searchParams;
  const platform     = params.get('platform');
  const category     = params.get('category');
  const min_discount = Number(params.get('min_discount') || 0);
  const max_price    = Number(params.get('max_price') || 999999);
  const sort         = params.get('sort') || 'score';
  const page         = Math.max(1, Number(params.get('page') || 1));
  const limit        = Math.min(50, Math.max(1, Number(params.get('limit') || 20)));
  const pro_only     = params.get('pro_only') === 'true';

  // ── PERF-03: Normalise cache key — prevent fragmentation from param ordering
  const normalizedParams = new URLSearchParams();
  const paramKeys = ['platform', 'category', 'min_discount', 'max_price', 'sort', 'page', 'limit', 'pro_only'];
  paramKeys.forEach(key => {
    const val = params.get(key);
    if (val !== null && val !== '' && val !== '0') normalizedParams.set(key, val);
  });
  normalizedParams.sort();

  const cacheKey = CACHE_KEYS.DEAL_LIST(normalizedParams.toString());
  const cached   = await redis.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  await connectDB();

  const query: any = {
    is_active:        true,
    discount_percent: { $gte: min_discount },
    discounted_price: { $lte: max_price },
  };
  if (platform) query.source_platform  = platform;
  if (category) query.category         = category;
  if (pro_only) query.is_pro_exclusive = true;

  // ── FIX-DAY2: Homepage quality gate ────────────────────────────────────────
  // When browsing the homepage feed (no category/platform filter, sorted by
  // score), enforce a minimum Shadow Score of 55 ("Fair+" only).
  // Category pages and filtered views allow lower-scored deals through so
  // users can still browse the full catalog.
  const isHomepageFeed = !platform && !category && sort === 'score';
  if (isHomepageFeed) {
    query.deal_score = { $gte: 55 };
  }

  const VALID_SORT = ['newest', 'discount', 'score'] as const;
  const safeSortKey = VALID_SORT.includes(sort as any)
    ? (sort as (typeof VALID_SORT)[number])
    : 'score';

  const sortMap: Record<string, any> = {
    newest:   { scraped_at: -1 },
    discount: { discount_percent: -1 },
    score:    { deal_score: -1 },
  };

  // ── BUG-04: Fixed homepage pagination ─────────────────────────────────────
  // Previous code hardcoded fetchOffset=0 for homepage, making all pages
  // return the same deals. Now each page correctly skips previous batches.
  const fetchLimit  = isHomepageFeed ? limit * 6 : limit;
  const fetchOffset = isHomepageFeed ? (page - 1) * (limit * 6) : (page - 1) * limit;

  const [rawDeals, total] = await Promise.all([
    Deal.find(query)
      .select(FEED_PROJECTION)   // PERF-01: projection — don't fetch description/price_history
      .sort(sortMap[safeSortKey])
      .skip(fetchOffset)
      .limit(fetchLimit)
      .lean(),
    Deal.countDocuments(query),
  ]);

  // ── FIX-DAY4: Provider diversity cap (homepage only) ──────────────────────
  let finalDeals = rawDeals;
  let meta: Record<string, any> = {};

  if (isHomepageFeed) {
    const { diversified, activePlatforms, singleSourceWarning } =
      applyDiversityCap(rawDeals, limit);
    finalDeals = diversified;
    meta = {
      platforms_in_feed:     activePlatforms,
      single_source_warning: singleSourceWarning,
      quality_gate_applied:  true,
      min_score_threshold:   55,
    };
  }

  const result = {
    deals:   finalDeals,
    total,
    page,
    hasMore: page * limit < total,
    meta,
  };

  await redis.set(cacheKey, result, { ex: CACHE_TTL.DEAL_LIST });
  return NextResponse.json(result);
}
