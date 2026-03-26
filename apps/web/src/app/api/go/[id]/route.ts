import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
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
      { new: true, select: 'affiliate_url is_active title' }
    ).lean();

    if (!deal || !deal.affiliate_url) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Permanent redirect to the affiliate URL
    return NextResponse.redirect(deal.affiliate_url, { status: 302 });
  } catch (err) {
    console.error('[/api/go] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
