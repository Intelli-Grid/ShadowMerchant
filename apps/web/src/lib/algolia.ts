import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY!;

// Public search client (safe for browser)
export const searchClient = algoliasearch(APP_ID, SEARCH_KEY);

// Admin client (server-side only — used to index deals)
export const adminClient = algoliasearch(APP_ID, ADMIN_KEY || SEARCH_KEY);

export const ALGOLIA_INDEX = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || 'Shadow_Merchant';
