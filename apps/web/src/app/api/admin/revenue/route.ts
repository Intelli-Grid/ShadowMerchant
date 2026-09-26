import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

// ₹199/month is the current published price for new subscriptions.
// NOTE: The only existing ₹99 subscription is the owner's test account, not a real customer.
// After the owner cancels their test sub, all active subscriptions will be at ₹199.
const MONTHLY_PLAN_PRICE = 199;   // ₹199/month (new subscriptions)
const ANNUAL_PLAN_PRICE  = 1799; // ₹1,799/year → ₹149.92/mo effective

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
    monthlyPlanUsers,
    annualPlanUsers,
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
    User.countDocuments({ subscription_tier: 'pro', subscription_status: 'active', subscription_plan: 'monthly' }),
    User.countDocuments({ subscription_tier: 'pro', subscription_status: 'active', subscription_plan: 'annual' }),
  ]);

  // MRR: monthly subs × ₹199 + annual subs × (₹1,799/12)
  // Users with no plan recorded (legacy/owner test) are assumed monthly at ₹199 — approximate
  const unknownPlanUsers = activeSubUsers - monthlyPlanUsers - annualPlanUsers;
  const estimatedMRR = Math.round(
    (monthlyPlanUsers + unknownPlanUsers) * MONTHLY_PLAN_PRICE +
    annualPlanUsers * (ANNUAL_PLAN_PRICE / 12)
  );


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
      planBreakdown: { monthly: monthlyPlanUsers, annual: annualPlanUsers, unknown: unknownPlanUsers },
      note: `MRR = (${monthlyPlanUsers + unknownPlanUsers} monthly × ₹199) + (${annualPlanUsers} annual × ₹149.92/mo) — approx during plan transition`,
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
