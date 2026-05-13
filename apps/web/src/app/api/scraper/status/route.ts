import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

// ─── Types ───────────────────────────────────────────────────────────────────
type Freshness = 'green' | 'amber' | 'red' | 'unknown';
type ScraperStatus = 'ok' | 'failed' | 'timeout' | 'never_run';

interface ScraperStatusEntry {
  store: string;
  last_run: Date | null;
  items_found: number;
  elapsed_seconds: number;
  status: ScraperStatus;
  freshness: Freshness;
  minutes_ago: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getFreshness(lastRun: Date | null): Freshness {
  if (!lastRun) return 'unknown';
  const minutesAgo = (Date.now() - new Date(lastRun).getTime()) / 60000;
  if (minutesAgo < 30) return 'green';
  if (minutesAgo < 180) return 'amber';
  return 'red';
}

function getMinutesAgo(lastRun: Date | null): number | null {
  if (!lastRun) return null;
  return Math.round((Date.now() - new Date(lastRun).getTime()) / 60000);
}

// ─── Route ───────────────────────────────────────────────────────────────────
const KNOWN_PLATFORMS = [
  'amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma', 'tatacliq',
];

/**
 * GET /api/scraper/status
 *
 * Returns real-time scraper health for all known platforms.
 * Reads from the scraper_health MongoDB collection written by scheduler.py.
 *
 * Response freshness:
 *   green  = last run < 30 min ago
 *   amber  = last run 30 min – 3 h ago
 *   red    = last run > 3 h ago OR failed
 *   unknown = never run
 *
 * No auth required — public read. Cache: 5 minutes.
 */
export async function GET() {
  try {
    await connectDB();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 });
    }

    // Get the most recent record per platform from scraper_health
    const pipeline = [
      { $sort: { run_at: -1 as const } },
      {
        $group: {
          _id: '$platform',
          last_run:        { $first: '$run_at' },
          items_found:     { $first: '$deals_collected' },
          elapsed_seconds: { $first: '$elapsed_seconds' },
          status:          { $first: '$status' },
        },
      },
    ];

    const results = await db
      .collection('scraper_health')
      .aggregate(pipeline)
      .toArray();

    // Index by platform name for fast lookup
    const dbMap: Record<string, (typeof results)[0]> = {};
    for (const r of results) {
      dbMap[r._id as string] = r;
    }

    // Build response — include every known platform even if never scraped
    const scrapers: ScraperStatusEntry[] = KNOWN_PLATFORMS.map((platform) => {
      const r = dbMap[platform];
      const lastRun = r?.last_run ? new Date(r.last_run) : null;
      return {
        store:           platform,
        last_run:        lastRun,
        items_found:     r?.items_found   ?? 0,
        elapsed_seconds: r?.elapsed_seconds ?? 0,
        status:          (r?.status as ScraperStatus) ?? 'never_run',
        freshness:       getFreshness(lastRun),
        minutes_ago:     getMinutesAgo(lastRun),
      };
    });

    // Summary counts
    const summary = {
      total:    scrapers.length,
      healthy:  scrapers.filter(s => s.freshness === 'green').length,
      stale:    scrapers.filter(s => s.freshness === 'amber').length,
      dead:     scrapers.filter(s => s.freshness === 'red' || s.status === 'never_run').length,
    };

    return NextResponse.json(
      { scrapers, summary, as_of: new Date() },
      {
        headers: {
          // Cache for 5 minutes — short enough to reflect live failures
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    console.error('[/api/scraper/status]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
