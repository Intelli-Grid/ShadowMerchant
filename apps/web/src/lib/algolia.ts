import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || '';

// Public search client — safe for browser use. Never import adminClient from here.
// Server-side indexing operations must import from '@/lib/algolia.server'
// Guarded: returns null when env vars are missing (preview deploys, build time).
// Callers must check `searchClient !== null` before invoking search methods.
export const searchClient = APP_ID && SEARCH_KEY
  ? algoliasearch(APP_ID, SEARCH_KEY)
  : null;

export const ALGOLIA_INDEX = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || 'Shadow_Merchant';
