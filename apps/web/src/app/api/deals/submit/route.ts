import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import DealSubmission from '@/models/DealSubmission';

// Allowed platforms for URL validation
const ALLOWED_DOMAINS = [
  'amazon.in', 'www.amazon.in',
  'flipkart.com', 'www.flipkart.com',
  'myntra.com', 'www.myntra.com',
  'meesho.com', 'www.meesho.com',
  'nykaa.com', 'www.nykaa.com',
  'nykaafashion.com', 'www.nykaafashion.com',
];

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * POST /api/deals/submit
 * Submit a user-found deal for review.
 * Available to all logged-in users.
 * Body: { url: string, reported_price?: number, notes?: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { url, reported_price, notes } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Validate URL domain
  const domain = extractDomain(url.trim());
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return NextResponse.json(
      {
        error: `URL must be from a supported platform: ${['Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Nykaa'].join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Validate notes length
  if (notes && typeof notes === 'string' && notes.length > 500) {
    return NextResponse.json({ error: 'Notes must be under 500 characters' }, { status: 400 });
  }

  // Rate limit: max 5 submissions per user per day
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const submissionsToday = await DealSubmission.countDocuments({
    user_id: userId,
    created_at: { $gte: today },
  });

  if (submissionsToday >= 5) {
    return NextResponse.json(
      { error: 'You can submit up to 5 deals per day. Thank you for contributing!' },
      { status: 429 }
    );
  }

  // Check for duplicate URL already pending/approved
  const existing = await DealSubmission.findOne({
    url: url.trim(),
    status: { $in: ['pending', 'approved'] },
  }).lean();

  if (existing) {
    return NextResponse.json(
      { error: 'This deal has already been submitted and is under review.' },
      { status: 409 }
    );
  }

  const submission = await DealSubmission.create({
    user_id: userId,
    url: url.trim(),
    reported_price: reported_price ? parseFloat(String(reported_price)) : undefined,
    notes: notes?.trim() || undefined,
    status: 'pending',
  });

  return NextResponse.json(
    {
      success: true,
      submission_id: String(submission._id),
      message: 'Deal submitted! We review all submissions within 24 hours.',
    },
    { status: 201 }
  );
}

/**
 * GET /api/deals/submit
 * List the current user's submissions.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const submissions = await DealSubmission.find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(20)
    .lean();

  return NextResponse.json({ submissions });
}
