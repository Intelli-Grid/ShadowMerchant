import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

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

// ─── Rate Limiters ──────────────────────────────────────────────────────────
// Used by public API routes to prevent catalog scraping and DDoS.
// Falls back to a no-op mock when Redis is unavailable (dev/staging).

const ratelimitMock = {
  limit: async (_id: string) => ({ success: true, limit: 30, remaining: 30, reset: 0, pending: Promise.resolve() }),
};

// Standard limit — 30 requests per minute per IP (deal lists, deal detail)
export const ratelimit: Ratelimit | typeof ratelimitMock =
  process.env.UPSTASH_REDIS_REST_URL
    ? new Ratelimit({
        redis: redis as Redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
        prefix: 'sm_rl',
      })
    : ratelimitMock;

// Strict limit — 10 requests per minute per IP (search route)
export const ratelimitSearch: Ratelimit | typeof ratelimitMock =
  process.env.UPSTASH_REDIS_REST_URL
    ? new Ratelimit({
        redis: redis as Redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'sm_rl_search',
      })
    : ratelimitMock;

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
