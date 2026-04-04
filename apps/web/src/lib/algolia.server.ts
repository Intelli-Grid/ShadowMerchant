// server-only ensures this module can NEVER be imported in client components.
// If you accidentally import this from a client boundary, Next.js will throw
// a build error instead of silently leaking the admin key to the browser.
import 'server-only';
import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY!;

if (!ADMIN_KEY) {
  // Throw at module load time so indexing failures are caught immediately,
  // not silently swallowed with a 403 after using the search key as fallback.
  throw new Error('[algolia.server] ALGOLIA_ADMIN_KEY is not set in environment variables.');
}

// Admin client — server-side only. Used for indexing deals after scraper runs.
export const adminClient = algoliasearch(APP_ID, ADMIN_KEY);

export { ALGOLIA_INDEX } from './algolia';
