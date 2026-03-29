import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;

    // Atomically increment click_count and return the affiliate URL
    const deal = await Deal.findByIdAndUpdate(
      id,
      { $inc: { click_count: 1 } },
      { new: true, select: 'affiliate_url is_active title source_platform category discount_percent deal_score' }
    ).lean() as any;

    if (!deal || !deal.affiliate_url) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // ── PostHog server-side event via REST API (no npm package needed) ────────
    const phKey = process.env.POSTHOG_PROJECT_API_KEY;
    if (phKey) {
      const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
      const distinctId = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';
      // Fire-and-forget — don't await so we don't delay the redirect
      fetch(`${phHost}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: phKey,
          event: 'deal_clicked',
          distinct_id: distinctId,
          properties: {
            deal_id: id,
            title: deal.title,
            platform: deal.source_platform,
            category: deal.category,
            discount_percent: deal.discount_percent,
            deal_score: deal.deal_score,
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // Swallow errors — analytics must never break redirects
    }

    // Permanent redirect to the affiliate URL
    return NextResponse.redirect(deal.affiliate_url, { status: 302 });
  } catch (err) {
    console.error('[/api/go] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
