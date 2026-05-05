/**
 * POST /api/deals/[id]/validate
 *
 * TASK-12 / Phase 3 Scale Hygiene: Redis-cached deal validation.
 * - Cache key: deal_live:<id> with 15-min TTL
 * - On cache hit: return immediately (no HEAD request)
 * - On cache miss: run HEAD check, store result in Redis
 *
 * This prevents the validate HEAD request from firing on every DealCard click
 * for the same popular deal within a 15-minute window.
 */

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Deal from '@/models/Deal';
import { redis } from '@/lib/redis';

const MONGODB_URI = process.env.MONGODB_URI;
const CACHE_TTL_SECONDS = 900; // 15 minutes

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    if (!MONGODB_URI) throw new Error('MONGODB_URI not defined');
    await mongoose.connect(MONGODB_URI);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

