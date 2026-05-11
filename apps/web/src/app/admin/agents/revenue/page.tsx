import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Deal from '@/models/Deal';
import {
  KPICard,
  SectionHeader,
  AdminCard,
  Badge,
} from '@/components/admin';
import { ChurnPreventer } from '@/components/admin/ChurnPreventer';

async function getRevenueData() {
  await connectDB();

  const [
    totalUsers,
    proUsers,
    activeSubUsers,
    haltedSubUsers,
    cancelledSubUsers,
    newProLast30d,
    churnRiskUsers,
    totalAlerts,
    alertsFired,
    totalClicksResult,
    topClickedDeals,
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
      { clerk_id: 1, email: 1, name: 1, subscription_expires_at: 1 }
    )
      .lean()
      .limit(15),

    Alert.countDocuments({ is_active: true }),
    Alert.countDocuments({ times_triggered: { $gt: 0 } }),

    Deal.aggregate([{ $group: { _id: null, total: { $sum: '$click_count' } } }]),
    Deal.find(
      { is_active: true, click_count: { $gt: 0 } },
      { title: 1, click_count: 1, source_platform: 1, deal_score: 1 }
    )
      .sort({ click_count: -1 })
      .limit(5)
      .lean(),
  ]);

  const estimatedMRR = activeSubUsers * 99;

  return {
    users: { total: totalUsers, pro: proUsers, free: totalUsers - proUsers, newProLast30d },
    subscriptions: { active: activeSubUsers, halted: haltedSubUsers, cancelled: cancelledSubUsers },
    estimatedMRR,
    churnRiskUsers,
    alerts: { total: totalAlerts, fired: alertsFired },
    clicks: { total: totalClicksResult[0]?.total || 0, topDeals: topClickedDeals },
  };
}

export default async function RevenueAgentPage() {
  const data = await getRevenueData();

  const conversionRate =
    data.users.total > 0
      ? ((data.users.pro / data.users.total) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'white', fontFamily: 'var(--font-display)' }}>
          💰 Revenue Agents
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Subscriptions, affiliate clicks, and churn prevention
        </p>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Estimated MRR"
          value={`₹${data.estimatedMRR.toLocaleString('en-IN')}`}
          sub="at ₹99/active Pro sub"
          accent="gold"
        />
        <KPICard
          label="Estimated ARR"
          value={`₹${(data.estimatedMRR * 12).toLocaleString('en-IN')}`}
          sub="annualised"
          accent="gold"
        />
        <KPICard
          label="Pro Conversion"
          value={`${conversionRate}%`}
          accent={parseFloat(conversionRate) >= 5 ? 'green' : parseFloat(conversionRate) >= 2 ? 'amber' : 'red'}
        />
        <KPICard
          label="Churn Risk (7d)"
          value={data.churnRiskUsers.length.toString()}
          sub="Pro subs expiring soon"
          accent={data.churnRiskUsers.length > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Users" value={data.users.total.toLocaleString('en-IN')} accent="blue" />
        <KPICard label="Pro Members" value={data.users.pro.toString()} sub={`+${data.users.newProLast30d} this month`} accent="gold" />
        <KPICard label="Active Alerts" value={data.alerts.total.toString()} sub={`${data.alerts.fired} have fired`} accent="amber" />
        <KPICard label="Total Clicks" value={data.clicks.total.toLocaleString('en-IN')} sub="affiliate link taps" accent="blue" />
      </div>

      {/* Subscription breakdown + Top clicked deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription status */}
        <AdminCard>
          <SectionHeader title="Subscription Status" sub="Pro member breakdown" />
          <div className="space-y-2.5">
            {[
              { label: 'Active', count: data.subscriptions.active, color: '#22c55e' },
              { label: 'Halted', count: data.subscriptions.halted, color: '#f59e0b' },
              { label: 'Cancelled', count: data.subscriptions.cancelled, color: '#ef4444' },
              { label: 'Other/Unknown', count: data.users.pro - data.subscriptions.active - data.subscriptions.halted - data.subscriptions.cancelled, color: 'var(--text-muted)' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="font-bold" style={{ color }}>{count}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-4" style={{ color: 'var(--text-muted)' }}>
            💡 Connect Razorpay API for exact subscription_status data.
          </p>
        </AdminCard>

        {/* Top clicked deals */}
        <AdminCard>
          <SectionHeader title="Top Clicked Deals" sub="highest affiliate traffic" />
          {data.clicks.topDeals.length > 0 ? (
            <div className="space-y-1">
              {data.clicks.topDeals.map((d: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-2"
                  style={{ borderBottom: '1px solid var(--sm-border)' }}
                >
                  <span className="flex-1 truncate mr-3" style={{ color: 'var(--text-secondary)' }}>
                    {d.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge color="blue">{d.source_platform}</Badge>
                    <span className="font-bold text-[11px]" style={{ color: 'var(--gold)' }}>
                      {d.click_count} clicks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No clicks tracked yet.</p>
          )}
        </AdminCard>
      </div>

      {/* Churn risk users + prevention */}
      {data.churnRiskUsers.length > 0 && (
        <AdminCard>
          <SectionHeader
            title={`Churn Risk Users (${data.churnRiskUsers.length})`}
            sub="Pro subs expiring within 7 days"
          />
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sm-border)' }}>
                  {['Name/Email', 'Expires', 'Days Left', 'Action'].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.churnRiskUsers.map((u: any) => {
                  const daysLeft = Math.ceil(
                    (new Date(u.subscription_expires_at).getTime() - Date.now()) / 86400000
                  );
                  return (
                    <tr key={u.clerk_id} style={{ borderBottom: '1px solid var(--sm-border)' }}>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)' }}>
                        {u.name || u.email}
                      </td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--text-muted)' }}>
                        {new Date(u.subscription_expires_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge color={daysLeft <= 2 ? 'red' : daysLeft <= 4 ? 'amber' : 'green'}>
                          {daysLeft}d
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <ChurnPreventer clerkUserId={u.clerk_id} userName={u.name || u.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </div>
  );
}
