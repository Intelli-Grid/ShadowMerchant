import { MetadataRoute } from 'next';
import { connectDB } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online';

// All 12 canonical category slugs used by the pipeline
const CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports',
  'books', 'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming',
];

// All active store/platform slugs
const PLATFORMS = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE_URL}/deals/feed`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/deals`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/pro`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
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
  let dealRoutes: MetadataRoute.Sitemap = [];
  try {
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;
    const deals = await Deal.find({ is_active: true }, { _id: 1 }).lean();
    dealRoutes = deals.map((deal: { _id: any }) => ({
      url: `${BASE_URL}/deals/${String(deal._id)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }));
  } catch (_) {
    // Silently fall back to empty deal routes if DB is unavailable at build time
  }

  return [...staticRoutes, ...categoryRoutes, ...storeRoutes, ...dealRoutes];
}
