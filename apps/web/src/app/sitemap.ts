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

  // Directly query MongoDB for active deal IDs — avoids self-referential HTTP fetch
  // that can fail during Vercel build if the app isn't live yet.
  let dealRoutes: MetadataRoute.Sitemap = []
  try {
    await connectDB()
    const Deal = (await import('@/models/Deal')).default
    // SEO-FIX-02: Fetch both slug and _id.
    // New deals have a slug (keyword-rich URL). Old deals fall back to ObjectId.
    const deals = await Deal.find({ is_active: true }, { _id: 1, slug: 1 }).lean()
    dealRoutes = deals.map((deal: { _id: any; slug?: string }) => ({
      url: `${BASE_URL}/deals/${deal.slug || String(deal._id)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: deal.slug ? 0.7 : 0.5,  // Slug URLs get higher priority signal
    }))
  } catch (_) {
    // Silently fall back to empty deal routes if DB is unavailable at build time
  }


  return [...staticRoutes, ...categoryRoutes, ...storeRoutes, ...dealRoutes];
}
