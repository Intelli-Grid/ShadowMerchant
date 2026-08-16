import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendDealAlertEmail } from '@/lib/email';

/**
 * POST /api/internal/send-alert-email
 *
 * ARCH-01: Internal endpoint called by the Python trigger_alerts.py pipeline
 * to dispatch deal alert emails via Brevo when a user has no Telegram/WhatsApp
 * linked but has an active alert that matched a new deal.
 *
 * Authentication: Requires `x-internal-secret` header matching INTERNAL_API_SECRET.
 * This endpoint is NOT for public use — it is server-to-server only.
 *
 * Body:
 *   {
 *     email: string
 *     firstName?: string
 *     alertType?: string
 *     deal: {
 *       title: string
 *       discounted_price: number
 *       original_price?: number
 *       discount_percent?: number
 *       deal_score?: number
 *       source_platform?: string
 *       slug?: string
 *       _id?: string
 *     }
 *   }
 */
export async function POST(req: NextRequest) {
  // ── Auth: internal server-to-server secret ─────────────────────────────────
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.error('[send-alert-email] INTERNAL_API_SECRET is not configured');
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, firstName, deal, alertType } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (!deal || !deal.title || deal.discounted_price == null) {
    return NextResponse.json({ error: 'deal.title and deal.discounted_price are required' }, { status: 400 });
  }

  const sent = await sendDealAlertEmail(
    email,
    firstName ?? undefined,
    deal,
    alertType ?? 'price alert'
  );

  if (!sent) {
    return NextResponse.json({ error: 'Email send failed — check BREVO_API_KEY' }, { status: 503 });
  }

  return NextResponse.json({ success: true, sentTo: email });
}
