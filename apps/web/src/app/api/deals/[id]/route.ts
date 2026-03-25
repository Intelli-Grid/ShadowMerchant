import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectDB();
  const deal = await Deal.findById(params.id).lean();
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const similar = await Deal.find({
    category: deal.category,
    _id: { $ne: deal._id },
    is_active: true,
  }).sort({ deal_score: -1 }).limit(6).lean();

  return NextResponse.json({ deal, price_history: deal.price_history, similar_deals: similar });
}
