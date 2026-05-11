import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch a URL and return its HTTP status code (timeout-safe). */
async function checkUrl(url: string): Promise<{ url: string; status: number | null; ok: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'ShadowMerchant-Admin-Bot/1.0' },
    });
    clearTimeout(timeout);
    return { url, status: res.status, ok: res.ok };
  } catch {
    return { url, status: null, ok: false };
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const domain =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://shadowmerchant.online';

  try {
    await connectDB();

    // ── 1. Indexable page counts ───────────────────────────────────────────
    const [activeDeals, categories] = await Promise.all([
      Deal.countDocuments({ is_active: true }),
      Deal.distinct('category', { is_active: true }),
    ]);

    // Unique non-null categories
    const activeCategories = (categories as (string | null)[]).filter(Boolean);

    // Static page count (homepage + about + pricing + sign-in + sign-up)
    const staticPages = 5;
    const totalIndexablePages = activeDeals + activeCategories.length + staticPages;

    // ── 2. Live HTTP checks ────────────────────────────────────────────────
    const [robotsCheck, sitemapCheck, homepageCheck] = await Promise.all([
      checkUrl(`${domain}/robots.txt`),
      checkUrl(`${domain}/sitemap.xml`),
      checkUrl(`${domain}`),
    ]);

    // ── 3. Sitemap content sanity check (count <url> entries) ─────────────
    let sitemapUrlCount: number | null = null;
    let sitemapSample: string[] = [];

    if (sitemapCheck.ok) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const sitemapRes = await fetch(`${domain}/sitemap.xml`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'ShadowMerchant-Admin-Bot/1.0' },
        });
        clearTimeout(timeout);
        const xml = await sitemapRes.text();

        // Count <loc> entries as a proxy for URL count
        const locMatches = xml.match(/<loc>/g);
        sitemapUrlCount = locMatches ? locMatches.length : 0;

        // Extract first 5 URLs for spot-check
        const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
        sitemapSample = urlMatches
          .slice(0, 5)
          .map((m) => m.replace(/<\/?loc>/g, ''));
      } catch {
        // Non-fatal — sitemap content check is best-effort
      }
    }

    // ── 4. robots.txt content check ───────────────────────────────────────
    let robotsAllowsIndexing = false;
    let robotsBlocksAdmin = false;

    if (robotsCheck.ok) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const robotsRes = await fetch(`${domain}/robots.txt`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'ShadowMerchant-Admin-Bot/1.0' },
        });
        clearTimeout(timeout);
        const robotsTxt = await robotsRes.text();

        robotsAllowsIndexing =
          robotsTxt.includes('Allow: /') ||
          (!robotsTxt.includes('Disallow: /\n') && !robotsTxt.includes('Disallow: / '));
        robotsBlocksAdmin =
          robotsTxt.includes('Disallow: /admin') ||
          robotsTxt.includes('Disallow: /admin/');
      } catch {
        // Non-fatal
      }
    }

    // ── 5. Overall SEO health score (simple heuristic 0–100) ─────────────
    let healthScore = 0;
    if (homepageCheck.ok) healthScore += 25;
    if (sitemapCheck.ok) healthScore += 25;
    if (robotsCheck.ok) healthScore += 15;
    if (robotsBlocksAdmin) healthScore += 10;
    if (sitemapUrlCount !== null && sitemapUrlCount > 10) healthScore += 15;
    if (activeDeals > 100) healthScore += 10;

    const healthLabel =
      healthScore >= 80 ? 'good' : healthScore >= 50 ? 'warning' : 'critical';

    return NextResponse.json({
      domain,
      indexablePages: {
        activeDeals,
        activeCategories: activeCategories.length,
        staticPages,
        total: totalIndexablePages,
      },
      checks: {
        homepage: homepageCheck,
        sitemap: sitemapCheck,
        robots: robotsCheck,
      },
      sitemap: {
        urlCount: sitemapUrlCount,
        sample: sitemapSample,
      },
      robots: {
        allowsIndexing: robotsAllowsIndexing,
        blocksAdmin: robotsBlocksAdmin,
      },
      health: {
        score: healthScore,
        label: healthLabel,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[/api/admin/seo] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
