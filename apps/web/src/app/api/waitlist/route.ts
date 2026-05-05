/**
 * POST /api/waitlist
 *
 * TASK-5 / Sprint 4B — Captures email signups from empty category states.
 * Stores to MongoDB `waitlist` collection for later Deal-of-the-Day email loop.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import mongoose, { Schema } from 'mongoose';

// Inline model — no separate file needed for a simple collection
const WaitlistSchema = new Schema(
  {
    email:  { type: String, required: true, lowercase: true, trim: true },
    source: { type: String, default: 'unknown' },
  },
  { timestamps: { createdAt: 'created_at' } }
);
// Prevent duplicate email+source pairs
WaitlistSchema.index({ email: 1, source: 1 }, { unique: true });

const Waitlist =
  mongoose.models.Waitlist || mongoose.model('Waitlist', WaitlistSchema);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email || '').trim().toLowerCase();
    const source = (body?.source || 'unknown').trim().slice(0, 100);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    await connectDB();

    // upsert — idempotent, won't error on duplicate signup
    await Waitlist.findOneAndUpdate(
      { email, source },
      { email, source },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    // Duplicate key (11000) = already subscribed — still return 200
    if (error?.code === 11000) {
      return NextResponse.json({ ok: true });
    }
    console.error('[Waitlist] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
