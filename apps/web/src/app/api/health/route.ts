import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { redis } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Health-check endpoint for Vercel, uptime monitors, and load balancers.
 * Returns 200 if all critical services are reachable, 503 if any are degraded.
 *
 * Response body:
 *   { status: "healthy" | "degraded", checks: { api, db, redis }, timestamp }
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {
    api:   'ok',
    db:    'error',
    redis: 'error',
  };
  let httpStatus = 200;

  // ── MongoDB connectivity ──────────────────────────────────────────────────
  try {
    await connectDB();
    checks.db = 'ok';
  } catch (err) {
    console.error('[health] MongoDB check failed:', err);
    httpStatus = 503;
  }

  // ── Upstash Redis connectivity ────────────────────────────────────────────
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (err) {
    console.error('[health] Redis check failed:', err);
    httpStatus = 503;
  }

  return NextResponse.json(
    {
      status:    httpStatus === 200 ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version:   process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
    },
    {
      status:  httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
