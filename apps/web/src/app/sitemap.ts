import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/db';

// FIX-SEO-SM-01: Guard against misconfigured NEXT_PUBLIC_APP_URL=http://localhost:3000
// (current Vercel state). A sitemap full of localhost URLs is invisible to Google.
// Always fall back to the canonical production domain if the env var is local.
const _rawUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online';
const BASE_URL = _rawUrl.startsWith('http://localhost') || _rawUrl.startsWith('https://localhost')
  ? 'https://www.shadowmerchant.online'
  : _rawUrl.replace(/\/$/, '');

// All 12 canonical category slugs used by the pipeline
const CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports',
  'books', 'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming',
];

// All active store/platform slugs
const PLATFORMS = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma', 'tatacliq'];

// PSEO-01: All known exposed sale event slugs (static — matches exposed/[slug]/page.tsx config)
const EXPOSED_SLUGS = [
  'amazon-great-indian-festival',
  'flipkart-big-billion-days',
  'amazon-prime-day',
  'myntra-end-of-reason-sale',
  'nykaa-pink-friday',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE_URL}/deals/feed`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/deals`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/category`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/pro`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/missed-deals`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/how-scoring-works`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE_URL}/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const storeRoutes: MetadataRoute.Sitemap = PLATFORMS.map((store) => ({
    url: `${BASE_URL}/store/${store}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // PSEO-01: Exposed verdict pages — static config, always in sitemap
  const exposedRoutes: MetadataRoute.Sitemap = EXPOSED_SLUGS.map((slug) => ({
    url: `${BASE_URL}/exposed/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8, // High — targets high-intent "is [sale] real?" queries
  }));

  // Directly query MongoDB for active deal IDs — avoids self-referential HTTP fetch
  // that can fail during Vercel build if the app isn't live yet.
  let dealRoutes: MetadataRoute.Sitemap = [];
  let brandRoutes: MetadataRoute.Sitemap = [];

  try {
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;

    // Deal pages — SEO-FIX-02: slug-first, ObjectId fallback
    const deals = await Deal.find({ is_active: true }, { _id: 1, slug: 1 }).lean();
    dealRoutes = deals.map((deal: { _id: any; slug?: string }) => ({
      url: `${BASE_URL}/deals/${deal.slug || String(deal._id)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: deal.slug ? 0.7 : 0.5,
    }));

    // PSEO-02: Brand pages — distinct active brands from DB, capped at 200
    const brands: string[] = await Deal.distinct('brand', {
      is_active: true,
      brand: { $nin: [null, ''] },
    });
    brandRoutes = brands
      .filter(Boolean)
      .slice(0, 200)
      .map((brand) => ({
        url: `${BASE_URL}/deals/brand/${encodeURIComponent(
          brand.toLowerCase().replace(/\s+/g, '-')
        )}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.65,
      }));
  } catch (_) {
    // Silently fall back — DB unavailable at build time is expected on first deploy
  }

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...storeRoutes,
    ...exposedRoutes,
    ...brandRoutes,
    ...dealRoutes,
  ];
}
