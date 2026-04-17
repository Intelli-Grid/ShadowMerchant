// server-only ensures this module can NEVER be imported in client components.
// If you accidentally import this from a client boundary, Next.js will throw
// a build error instead of silently leaking the admin key to the browser.
import 'server-only';
import { algoliasearch } from 'algoliasearch';

const APP_ID   = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || '';

// HIGH-02 fix: changed from module-level throw to a graceful null export.
// A hard throw at module load crashes the entire Next.js build if the secret
// is missing (e.g. staging environments, Vercel preview deployments).
// Callers should check `adminClient !== null` before invoking indexing methods.
if (!ADMIN_KEY) {
  console.warn(
    '[algolia.server] ALGOLIA_ADMIN_KEY is not set. ' +
    'Deal indexing will be disabled. Set the secret in Vercel dashboard.'
  );
}

// Admin client — server-side only. Used for indexing deals after scraper runs.
// Will be null if ALGOLIA_ADMIN_KEY is missing — callers must guard against this.
export const adminClient = ADMIN_KEY && APP_ID
  ? algoliasearch(APP_ID, ADMIN_KEY)
  : null;

export { ALGOLIA_INDEX } from './algolia';
