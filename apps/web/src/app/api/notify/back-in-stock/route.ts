import { NextRequest, NextResponse } from 'next/server';
import { ratelimit } from '@/lib/redis';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = parseInt(process.env.BREVO_BACK_IN_STOCK_LIST_ID || '2', 10);

export async function POST(req: NextRequest) {
  // Rate limit: 5 submissions per minute per IP — prevents email list pollution
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon';
  const { success } = await ratelimit.limit(`bis:${ip}`);
  if (!success) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  try {

    const { email, dealId, dealTitle } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
    }

    if (!BREVO_API_KEY) {
      console.error('[BackInStock] BREVO_API_KEY not set');
      return NextResponse.json({ success: false, error: 'Email service not configured' }, { status: 500 });
    }

    // Upsert contact to Brevo with deal metadata as attributes
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        attributes: {
          DEAL_ID: dealId || '',
          DEAL_TITLE: (dealTitle || '').slice(0, 100),
          SOURCE: 'missed-deals-page',
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true, // update existing contacts rather than error
      }),
    });

    if (res.ok || res.status === 204) {
      return NextResponse.json({ success: true });
    }

    const errBody = await res.text();
    console.error('[BackInStock] Brevo API error:', res.status, errBody);
    return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 500 });

  } catch (error) {
    console.error('[BackInStock] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
