import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Vercel to use a fresh build (busts restored build cache)
  generateBuildId: async () => `build-${Date.now()}`,
  images: {
    unoptimized: true,
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
    ],
  },
};

export default nextConfig;
