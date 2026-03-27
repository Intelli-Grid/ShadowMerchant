import { Redis } from '@upstash/redis';

// Only create a real Redis instance if the URL is provided, otherwise use a
// no-op mock so the app runs without cache (MongoDB is queried directly instead).
const redisMock = {
  get:  async (_key: string)                          => null,
  set:  async (_key: string, _val: unknown, _opts?: unknown) => null,
  keys: async (_pattern: string)                      => [] as string[],
  del:  async (..._keys: string[])                    => 0,
};

export const redis: Redis | typeof redisMock = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN || '' })
  : redisMock;

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
