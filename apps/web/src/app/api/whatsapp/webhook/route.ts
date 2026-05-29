import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * WhatsApp Business webhook verification (GET) and message handler (POST).
 * Register this URL in Meta Developer Console:
 *   Webhook URL: https://shadowmerchant.in/api/whatsapp/webhook
 *   Verify Token: matches WHATSAPP_VERIFY_TOKEN env var
 *
 * Security: POST handler verifies Meta's X-Hub-Signature-256 HMAC signature
 * before processing any payload. Unsigned requests are rejected with 401.
 */

export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode');
  const token     = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  // ── Verify Meta webhook signature (X-Hub-Signature-256) ─────────────────
  // Prevents spoofed events from arbitrary actors who know the webhook URL.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('[WhatsApp] WHATSAPP_APP_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  // Read raw body BEFORE parsing JSON — body can only be consumed once
  const rawBody = await req.text();

  const expectedSig =
    'sha256=' +
    createHmac('sha256', appSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  let signatureValid = false;
  try {
    const sigBuf      = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    signatureValid =
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    console.warn('[WhatsApp] Invalid webhook signature — request rejected');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── Parse body (already read as text above) ──────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Handle incoming messages
  const entry   = (body?.entry as any[])?.[0];
  const changes = entry?.changes?.[0];
  const value   = changes?.value;

  if (value?.messages) {
    for (const msg of value.messages) {
      const from = msg.from as string;
      const text = (msg.text?.body as string)?.toLowerCase() || '';

      console.log(`[WhatsApp] Message from ${from}: ${text}`);

      // Handle STOP unsubscribe
      if (text === 'stop') {
        // In production: update user record to disable whatsapp notifications
        console.log(`[WhatsApp] Unsubscribe request from ${from}`);
      }
    }
  }

  // Always return 200 to WhatsApp (Meta retries on non-2xx)
  return NextResponse.json({ status: 'ok' });
}
