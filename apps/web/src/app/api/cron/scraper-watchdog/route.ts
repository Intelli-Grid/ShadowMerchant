import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ScrapeLog from '@/models/ScrapeLog';

/**
 * GET /api/cron/scraper-watchdog
 *
 * Dead-man switch for the scraper pipeline.
 * Finds any ScrapeLog documents stuck in 'running' status for > 10 minutes
 * and force-transitions them to 'failed' so the UI never shows a permanent
 * "Scanning" state.
 *
 * Registered as a Vercel cron every 15 minutes (see vercel.json).
 * Security: requires Bearer CRON_SECRET header — same secret as refresh-deals.
 */
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error('[watchdog] CRON_SECRET env var is not set!');
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET missing' },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000);

    // Find all jobs that are marked 'running' but started more than 10 min ago
    const stuckJobs = await ScrapeLog.find({
      status: 'running',
      started_at: { $lt: TEN_MINUTES_AGO },
    }).lean();

    if (stuckJobs.length === 0) {
      return NextResponse.json({
        success: true,
        stuck_jobs_cleared: 0,
        message: 'No stuck jobs found.',
        checked_at: new Date(),
      });
    }

    // Force-complete each stuck job
    const stuckIds = stuckJobs.map((j: any) => j._id);
    const updateResult = await ScrapeLog.updateMany(
      { _id: { $in: stuckIds } },
      {
        $set: {
          status:        'failed',
          completed_at:  new Date(),
          error_message: 'Watchdog: job exceeded 10-minute timeout and was force-cleared.',
        },
      }
    );

    const clearedRunIds = stuckJobs.map((j: any) => j.run_id);
    console.warn(
      `[watchdog] Force-cleared ${updateResult.modifiedCount} stuck job(s): ${clearedRunIds.join(', ')}`
    );

    return NextResponse.json({
      success:            true,
      stuck_jobs_cleared: updateResult.modifiedCount,
      cleared_run_ids:    clearedRunIds,
      checked_at:         new Date(),
    });
  } catch (error: any) {
    console.error('[watchdog] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
