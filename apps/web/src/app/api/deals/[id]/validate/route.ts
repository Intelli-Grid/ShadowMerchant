/**
 * POST /api/deals/[id]/validate
 *
 * TASK-12 / Phase 3 Scale Hygiene: Redis-cached deal validation.
 * - Cache key: deal_live:<id> with 15-min TTL
 * - On cache hit: return immediately (no HEAD request)
 * - On cache miss: run HEAD check, store result in Redis
 *
 * Security: Requires a signed-in user (auth guard).
 * Unauthenticated requests are rejected to prevent
 * mass deal-deactivation attacks (DoS via stale marking).
 */

import { NextRequest, NextResponse } from 'next/server';
import Deal from '@/models/Deal';
import { redis, ratelimit } from '@/lib/redis';
import { connectDB } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

const CACHE_TTL_SECONDS = 900; // 15 minutes
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth guard: signed-in users only ────────────────────────────────────────
  // Prevents unauthenticated mass-deactivation of deals (DoS attack vector).
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 10/min per user — each call makes an outbound HTTP request (5s timeout)
  const { success: rlOk } = await ratelimit.limit(`validate:${userId}`);
  if (!rlOk) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await params;

  // ObjectId format guard — prevents Mongoose CastError → 500
  if (!OBJECT_ID_REGEX.test(id)) {
    return NextResponse.json({ success: false, error: 'Invalid deal ID' }, { status: 400 });
  }

  try {
    // ── Redis cache check ──────────────────────────────────────────────────
    const cacheKey = `deal_live:${id}`;
    const cached = await redis.get<{ priceChanged: boolean; currentPrice: number; checked_at: string }>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        priceChanged: cached.priceChanged,
        currentPrice: cached.currentPrice,
        cached: true,
      });
    }

    // ── DB fetch ───────────────────────────────────────────────────────────
    await connectDB();
    const deal = await Deal.findById(id).lean() as any;
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }

    // ── HEAD check on affiliate URL ────────────────────────────────────────
    let urlReachable = true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const headRes = await fetch(deal.affiliate_url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!headRes.ok) urlReachable = false;
    } catch {
      // Network error or timeout — treat as reachable (don't penalise valid deals)
      urlReachable = true;
    }

    if (!urlReachable) {
      // Mark as stale so scraper lifecycle picks it up
      await Deal.findByIdAndUpdate(id, { $set: { is_stale: true, is_active: false } });

      const result = { priceChanged: true, currentPrice: deal.discounted_price, checked_at: new Date().toISOString() };
      // Short TTL for expired deals — 5 min (so it re-checks after scraper can update)
      await redis.set(cacheKey, result, { ex: 300 });

      return NextResponse.json({
        success: false,
        priceChanged: true,
        message: 'Deal appears to be expired or unavailable.',
      });
    }

    // ── Cache the valid result ─────────────────────────────────────────────
    const result = {
      priceChanged: false,
      currentPrice: deal.discounted_price,
      checked_at: new Date().toISOString(),
    };
    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS });

    return NextResponse.json({
      success: true,
      priceChanged: false,
      currentPrice: deal.discounted_price,
    });

  } catch (error) {
    console.error('[ValidateDeal] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
