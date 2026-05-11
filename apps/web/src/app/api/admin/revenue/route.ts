import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

const MONTHLY_PLAN_PRICE = 99;    // ₹99/month
const ANNUAL_PLAN_PRICE  = 799;   // ₹799/year → ₹66.58/mo effective

export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const [
    totalUsers,
    proUsers,
    activeSubUsers,
    haltedSubUsers,
    cancelledSubUsers,
    newProLast30d,
    churnRiskUsers,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ subscription_tier: 'pro' }),
    User.countDocuments({ subscription_tier: 'pro', subscription_status: 'active' }),
    User.countDocuments({ subscription_tier: 'pro', subscription_status: 'halted' }),
    User.countDocuments({ subscription_tier: 'pro', subscription_status: 'cancelled' }),
    User.countDocuments({
      subscription_tier: 'pro',
      created_at: { $gte: new Date(Date.now() - 30 * 86400000) },
    }),
    User.find(
      {
        subscription_tier: 'pro',
        subscription_expires_at: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 86400000),
        },
      },
      { clerk_id: 1, email: 1, subscription_expires_at: 1, subscription_status: 1 }
    )
      .lean()
      .limit(20),
  ]);

  // Estimate MRR — all active Pro users × monthly equivalent
  // We can't distinguish monthly vs annual from current schema (no subscription_plan field)
  // so we use a conservative estimate of ₹99/mo per active sub
  const estimatedMRR = activeSubUsers * MONTHLY_PLAN_PRICE;

  // Subscription health breakdown
  const subscriptionBreakdown = {
    active:    activeSubUsers,
    halted:    haltedSubUsers,
    cancelled: cancelledSubUsers,
    other:     proUsers - activeSubUsers - haltedSubUsers - cancelledSubUsers,
  };

  return NextResponse.json({
    users: {
      total:   totalUsers,
      pro:     proUsers,
      free:    totalUsers - proUsers,
      conversionRate: totalUsers > 0
        ? `${((proUsers / totalUsers) * 100).toFixed(1)}%`
        : '0%',
      newProLast30d,
    },
    subscriptions: subscriptionBreakdown,
    revenue: {
      estimatedMRR,
      estimatedARR: estimatedMRR * 12,
      note: 'MRR estimated at ₹99/active sub. Connect Razorpay API for exact figures.',
    },
    churnRisk: {
      count: churnRiskUsers.length,
      users: churnRiskUsers.map((u: any) => ({
        email: u.email,
        expiresAt: u.subscription_expires_at,
        daysLeft: Math.ceil(
          (new Date(u.subscription_expires_at).getTime() - Date.now()) / 86400000
        ),
      })),
    },
    generatedAt: new Date().toISOString(),
  });
}
