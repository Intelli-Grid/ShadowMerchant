import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /pricing is caught by deals/[id] dynamic route — redirect to the actual pricing page
      {
        source: '/pricing',
        destination: '/pro',
        permanent: true, // 308 — tells Google the canonical pricing URL is /pro
      },
    ];
  },
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
          // ─── SEC-02: Content Security Policy (ENFORCING) ─────────────────
          // Switched from report-only to enforcing. Report-only was intended
          // as a 1-week monitoring phase — it has been more than 1 week.
          // All known legitimate origins are already in the allowlist below.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com https://clerk.shadowmerchant.online https://app.posthog.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://clerk.shadowmerchant.online https://api.clerk.dev https://app.posthog.com https://*.algolia.net https://*.algolianet.com wss://clerk.shadowmerchant.online https://api.razorpay.com https://o*.ingest.sentry.io",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
  images: {
    // Serve modern formats: AVIF is 50% smaller than WebP, WebP is 30% smaller than JPEG
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 24 hours at the CDN/browser level
    minimumCacheTTL: 86400,
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: 'rukminim2.flixcart.com' },
      { protocol: 'https', hostname: 'rukminim1.flixcart.com' },
      { protocol: 'https', hostname: 'assets.myntassets.com' },
      // BUG-07 fix: removed { protocol: 'http', hostname: 'assets.myntassets.com' }
      // Myntra CDN is exclusively HTTPS; HTTP entry caused mixed-content warnings.
      { protocol: 'https', hostname: 'images.meesho.com' },
      { protocol: 'https', hostname: 'adn-static1.nykaa.com' },
      { protocol: 'https', hostname: 'images-static.nykaa.com' },
      { protocol: 'https', hostname: 'www.croma.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // MED-12 fix: Tatacliq was in source_platform enum but domains were missing
      { protocol: 'https', hostname: 'img.tatacliq.com' },
      { protocol: 'https', hostname: 'images.tatacliq.com' },
    ],
  },
};

export default nextConfig;
