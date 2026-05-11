import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 });
  }

  await connectDB();

  const [distribution, platformAvgScores, totalActive] = await Promise.all([
    Deal.aggregate([
      { $match: { is_active: true } },
      {
        $bucket: {
          groupBy: '$deal_score',
          boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101],
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Deal.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: '$source_platform',
          avgScore: { $avg: '$deal_score' },
          count: { $sum: 1 },
          above80: { $sum: { $cond: [{ $gte: ['$deal_score', 80] }, 1, 0] } },
          below30: { $sum: { $cond: [{ $lt: ['$deal_score', 30] }, 1, 0] } },
        },
      },
    ]),
    Deal.countDocuments({ is_active: true }),
  ]);

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are the Shadow Score calibration engine for ShadowMerchant, India's AI-powered deal aggregator.

The Shadow Score (0–100) is calculated as:
- Discount depth:              35% weight (discount_percent / 70, capped at 1.0)
- Price drop vs 30d history:   20% weight
- Popularity (rating_count):   20% weight
- Seller rating:               15% weight
- Freshness (recency):         10% weight

Target distribution:
- 90–100: RARE (<2% of active deals) — exceptional deals only
- 80–89:  Very good (<10% total)
- 40–79:  Bulk of the catalog (healthy zone)
- <30:    Should NOT be trending

Analyse the data and respond in valid JSON only (no markdown):
{
  "health": "good|warning|critical",
  "issues": ["array of specific problems found"],
  "recommendations": ["array of specific calibration actions"],
  "meesho_inflation_risk": "low|medium|high",
  "summary": "1-2 sentence plain English summary"
}`,
        },
        {
          role: 'user',
          content: `Active deals: ${totalActive}
Score distribution (by 10-point buckets): ${JSON.stringify(distribution)}
Platform average scores: ${JSON.stringify(platformAvgScores)}

Analyse this distribution. Are scores calibrated correctly? Platform-specific issues?`,
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    return NextResponse.json({ error: `Groq error: ${groqRes.status}` }, { status: 502 });
  }

  const groqData = await groqRes.json();
  const rawText = groqData.choices?.[0]?.message?.content || '{}';

  let analysis: any;
  try {
    analysis = JSON.parse(rawText.replace(/```json|```/g, '').trim());
  } catch {
    analysis = { health: 'unknown', summary: rawText, issues: [], recommendations: [] };
  }

  return NextResponse.json({
    distribution,
    platformAvgScores,
    totalActive,
    analysis,
    calibratedAt: new Date().toISOString(),
  });
}
