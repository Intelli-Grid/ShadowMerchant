import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shadowmerchant.in';

const CATEGORIES = ['electronics', 'fashion', 'beauty', 'home', 'sports', 'books'];
const PLATFORMS = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE_URL}/deals/feed`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/deals`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/pro`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
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

  // Dynamically fetch active deal IDs for individual deal pages
  let dealRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${BASE_URL}/api/deals?limit=100&sort=newest`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      dealRoutes = (data.deals || []).map((deal: { _id: string }) => ({
        url: `${BASE_URL}/deals/${deal._id}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }
  } catch (_) {}

  return [...staticRoutes, ...categoryRoutes, ...storeRoutes, ...dealRoutes];
}
