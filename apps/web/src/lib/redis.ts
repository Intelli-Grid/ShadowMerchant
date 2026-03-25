import { Redis } from '@upstash/redis';



// Only create a real Redis instance if the URL is provided, otherwise mock it so Next.js doesn't crash
export const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN || '' })
  : { get: async () => null, set: async () => null };

export const CACHE_KEYS = {
  TRENDING_DEALS: 'deals:trending',
  CATEGORIES: 'categories:all',
  DEAL: (id: string) => `deal:${id}`,
  DEAL_LIST: (filters: string) => `deals:${filters}`,
};

export const CACHE_TTL = {
  TRENDING: 1800,   // 30 min
  CATEGORIES: 3600, // 1 hour
  DEAL: 900,        // 15 min
  DEAL_LIST: 300,   // 5 min
};
