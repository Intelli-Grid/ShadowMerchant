import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import User from '@/models/User';
import Alert from '@/models/Alert';
import ScrapeLog from '@/models/ScrapeLog';

export async function POST(req: NextRequest) {
  // Admin-only gate
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let query: string;
  try {
    const body = await req.json();
    query = body.query;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }
  if (query.length > 500) {
    return NextResponse.json({ error: 'Query too long (max 500 chars)' }, { status: 400 });
  }

  await connectDB();

  // ── Gather real-time business data in parallel ──────────────────────────
  const [dealStats, userStats, alertStats, scrapeHealth, platformBreakdown, scoreHealth] =
    await Promise.all([
      // Deal health — using $facet for a single aggregation pass
      Deal.aggregate([
        {
          $facet: {
            total:       [{ $count: 'n' }],
            active:      [{ $match: { is_active: true } }, { $count: 'n' }],
            trending:    [{ $match: { is_trending: true, is_active: true } }, { $count: 'n' }],
            last24h:     [{ $match: { scraped_at: { $gte: new Date(Date.now() - 86400000) }, is_active: true } }, { $count: 'n' }],
            suspect:     [{ $match: { is_active: true, discount_percent: { $gt: 85 } } }, { $count: 'n' }],
            lowTrending: [{ $match: { is_trending: true, deal_score: { $lt: 50 } } }, { $count: 'n' }],
          },
        },
      ]),

      // User health
      User.aggregate([
        {
          $facet: {
            total:     [{ $count: 'n' }],
            pro:       [{ $match: { subscription_tier: 'pro' } }, { $count: 'n' }],
            newToday:  [{ $match: { created_at: { $gte: new Date(Date.now() - 86400000) } } }, { $count: 'n' }],
            churnRisk: [
              {
                $match: {
                  subscription_tier: 'pro',
                  subscription_expires_at: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 7 * 86400000),
                  },
                },
              },
              { $count: 'n' },
            ],
          },
        },
      ]),

      // Alert health
      Alert.aggregate([
        {
          $facet: {
            active:    [{ $match: { is_active: true } }, { $count: 'n' }],
            firedWeek: [{ $match: { last_triggered: { $gte: new Date(Date.now() - 7 * 86400000) } } }, { $count: 'n' }],
          },
        },
      ]),

      // Latest scraper run
      ScrapeLog.findOne({}).sort({ started_at: -1 }).lean(),

      // Platform mix
      Deal.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: '$source_platform', count: { $sum: 1 }, avgScore: { $avg: '$deal_score' } } },
        { $sort: { count: -1 } },
      ]),

      // Score health
      Deal.aggregate([
        { $match: { is_active: true } },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$deal_score' },
            above80:  { $sum: { $cond: [{ $gte: ['$deal_score', 80] }, 1, 0] } },
            above60:  { $sum: { $cond: [{ $gte: ['$deal_score', 60] }, 1, 0] } },
            below30:  { $sum: { $cond: [{ $lt:  ['$deal_score', 30] }, 1, 0] } },
          },
        },
      ]),
    ]);

  // ── Extract clean values ────────────────────────────────────────────────
  const d = dealStats[0];
  const u = userStats[0];
  const a = alertStats[0];
  const lastScrape = scrapeHealth as any;

  const businessSnapshot = {
    deals: {
      total:                  d.total[0]?.n        || 0,
      active:                 d.active[0]?.n       || 0,
      trending:               d.trending[0]?.n     || 0,
      added_last_24h:         d.last24h[0]?.n      || 0,
      suspect_discounts_85pc: d.suspect[0]?.n      || 0,
      low_score_but_trending: d.lowTrending[0]?.n  || 0,
    },
    users: {
      total:                  u.total[0]?.n    || 0,
      pro:                    u.pro[0]?.n      || 0,
      new_today:              u.newToday[0]?.n || 0,
      churn_risk_next_7d:     u.churnRisk[0]?.n || 0,
      pro_conversion_rate:
        (u.total[0]?.n || 0) > 0
          ? `${(((u.pro[0]?.n || 0) / (u.total[0]?.n || 1)) * 100).toFixed(1)}%`
          : '0%',
    },
    alerts: {
      active:          a.active[0]?.n    || 0,
      fired_this_week: a.firedWeek[0]?.n || 0,
    },
    scraper: {
      last_run_platforms:  lastScrape?.scrapers_run?.join(', ') || 'unknown',
      last_run_status:     lastScrape?.status || 'unknown',
      last_run_time:       lastScrape?.started_at || null,
      hours_since_last_run: lastScrape?.started_at
        ? Math.round((Date.now() - new Date(lastScrape.started_at).getTime()) / 3600000)
        : null,
      deals_inserted_last_run: lastScrape?.total_deals_inserted || 0,
      total_errors_last_run:   lastScrape?.total_errors || 0,
    },
    platform_mix: platformBreakdown.map((p: any) => ({
      platform:   p._id,
      deal_count: p.count,
      avg_score:  Math.round(p.avgScore || 0),
    })),
    score_health: scoreHealth[0]
      ? {
          avg_score: Math.round(scoreHealth[0].avgScore || 0),
          above_80:  scoreHealth[0].above80,
          above_60:  scoreHealth[0].above60,
          below_30:  scoreHealth[0].below30,
        }
      : null,
  };

  // ── Call Groq ──────────────────────────────────────────────────
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured. Add it to your environment variables.' },
      { status: 503 }
    );
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `You are the AI business analyst for ShadowMerchant, India's AI-powered deal aggregator.
You have access to real-time platform data. Answer the founder's questions directly, specifically, and with actionable insight.

Platform context:
- ShadowMerchant aggregates deals from Amazon, Flipkart, Meesho, Myntra, Nykaa, Croma, TataCliq
- The Shadow Score (0–100) rates deal quality: 80+ = great, 60–79 = good, 40–59 = fair, <40 = low
- Pro tier = ₹99/month — Pro users get price alerts + full price history
- Scrapers run via GitHub Actions (Python pipeline)
- Redis caches trending deals & categories

Be direct, specific, and give clear action recommendations. If something looks broken, say so clearly.
If data is healthy, confirm it. Use Indian context (₹ currency, IST timezone awareness).
Keep responses under 250 words unless more detail is genuinely needed.
Do not use markdown headers — write in flowing paragraphs or short bullet lists.`,
        },
        {
          role: 'user',
          content: `Current business data snapshot:\n${JSON.stringify(businessSnapshot, null, 2)}\n\nFounder's question: ${query.trim()}`,
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error('[ai-query] Groq API error:', errText);
    return NextResponse.json(
      { error: `Groq API error: ${groqRes.status}` },
      { status: 502 }
    );
  }

  const groqData = await groqRes.json();
  const aiResponse = groqData.choices?.[0]?.message?.content || 'Unable to generate a response.';

  return NextResponse.json({ response: aiResponse, dataUsed: businessSnapshot });
}
