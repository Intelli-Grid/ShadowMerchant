import { MetadataRoute } from 'next';

// Guard against misconfigured NEXT_PUBLIC_APP_URL=http://localhost:3000
// (same guard as sitemap.ts — prevents localhost from appearing in robots.txt sitemap URL)
const _rawRobotsUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online';
const BASE_URL = _rawRobotsUrl.startsWith('http://localhost') || _rawRobotsUrl.startsWith('https://localhost')
  ? 'https://www.shadowmerchant.online'
  : _rawRobotsUrl.replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/', '/debug/', '/wishlist/', '/alerts/', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
