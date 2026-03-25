import { NextRequest, NextResponse } from 'next/server';

/**
 * WhatsApp Business webhook verification (GET) and message handler (POST).
 * Register this URL in Meta Developer Console:
 *   Webhook URL: https://shadowmerchant.in/api/whatsapp/webhook
 *   Verify Token: matches WHATSAPP_VERIFY_TOKEN env var
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
  const body = await req.json();

  // Handle incoming messages
  const entry   = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value   = changes?.value;

  if (value?.messages) {
    for (const msg of value.messages) {
      const from = msg.from;
      const text = msg.text?.body?.toLowerCase() || '';

      console.log(`[WhatsApp] Message from ${from}: ${text}`);

      // Handle STOP unsubscribe
      if (text === 'stop') {
        // In production: update user record to disable whatsapp notifications
        console.log(`[WhatsApp] Unsubscribe request from ${from}`);
      }
    }
  }

  // Always return 200 to WhatsApp
  return NextResponse.json({ status: 'ok' });
}
