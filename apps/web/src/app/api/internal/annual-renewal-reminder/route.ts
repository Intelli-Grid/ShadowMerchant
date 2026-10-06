import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { sendAnnualRenewalReminderEmail } from '@/lib/email';

/**
 * POST /api/internal/annual-renewal-reminder
 *
 * Called daily by the annual-renewal-reminder GitHub Actions workflow.
 * Sends a renewal reminder to annual Pro subscribers expiring within 7 days
 * who have not already received a reminder for this subscription period.
 * Idempotency: guarded by annual_reminder_sent_at (null = not yet reminded).
 *
 * Authentication: x-internal-secret header matching INTERNAL_API_SECRET.
 */
export async function POST(req: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.error('[annual-renewal-reminder] INTERNAL_API_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const providedSecret = req.headers.get('x-internal-secret');
  if (
    !providedSecret ||
    providedSecret.length !== internalSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(internalSecret))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  const candidates = await User.find({
    subscription_tier: 'pro',
    subscription_plan: 'annual',
    subscription_expires_at: { $gte: now, $lte: windowEnd },
    annual_reminder_sent_at: null,
  })
    .select('_id email name subscription_expires_at')
    .lean();

  let notified = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of candidates) {
    const u = user as any;
    if (!u.email) { skipped++; continue; }

    try {
      const sent = await sendAnnualRenewalReminderEmail(
        u.email,
        u.name?.split(' ')[0],
        u.subscription_expires_at ? new Date(u.subscription_expires_at) : undefined
      );

      if (sent) {
        await User.updateOne({ _id: u._id }, { annual_reminder_sent_at: new Date() });
        notified++;
        console.log(`[annual-renewal-reminder] Sent to ${u.email}`);
      } else {
        // Do NOT mark as sent — retry on next daily run
        errors++;
        console.error(`[annual-renewal-reminder] Email returned false for ${u.email}`);
      }
    } catch (err) {
      errors++;
      console.error(`[annual-renewal-reminder] Error for ${u.email}:`, err);
    }
  }

  console.log(`[annual-renewal-reminder] notified=${notified} skipped=${skipped} errors=${errors}`);
  return NextResponse.json({ notified, skipped, errors });
}
