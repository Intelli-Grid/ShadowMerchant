import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Deal from '@/models/Deal';

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    if (!MONGODB_URI) throw new Error('MONGODB_URI not defined');
    await mongoose.connect(MONGODB_URI);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await connectDB();

    const deal = await Deal.findById(id).lean() as any;
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }

    // Lightweight HEAD check on affiliate URL to detect redirect/price change signals
    let urlReachable = true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const headRes = await fetch(deal.affiliate_url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      // If the URL redirects to a homepage-like URL, deal may be stale
      if (!headRes.ok) urlReachable = false;
    } catch {
      // Network error or timeout — treat as reachable (don't penalise valid deals)
      urlReachable = true;
    }

    if (!urlReachable) {
      // Mark as stale so scraper lifecycle picks it up
      await Deal.findByIdAndUpdate(id, { $set: { is_stale: true, is_active: false } });
      return NextResponse.json({
        success: false,
        priceChanged: true,
        message: 'Deal appears to be expired or unavailable.',
      });
    }

    return NextResponse.json({
      success: true,
      priceChanged: false,
      currentPrice: deal.discounted_price,
    });
  } catch (error) {
    console.error('[ValidateDeal] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
