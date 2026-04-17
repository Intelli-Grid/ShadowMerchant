import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Link', value: '<https://clerk.shadowmerchant.online>; rel=preconnect, <https://app.posthog.com>; rel=preconnect' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: 'rukminim2.flixcart.com' },
      { protocol: 'https', hostname: 'rukminim1.flixcart.com' },
      { protocol: 'https', hostname: 'assets.myntassets.com' },
      { protocol: 'https', hostname: 'images.meesho.com' },
      { protocol: 'https', hostname: 'adn-static1.nykaa.com' },
      { protocol: 'https', hostname: 'www.croma.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // MED-12 fix: Tatacliq was in source_platform enum but domains were missing
      { protocol: 'https', hostname: 'img.tatacliq.com' },
      { protocol: 'https', hostname: 'images.tatacliq.com' },
    ],
  },
};

export default nextConfig;
