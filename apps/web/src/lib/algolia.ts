import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!;

// Public search client — safe for browser use. Never import adminClient from here.
// Server-side indexing operations must import from '@/lib/algolia.server'
export const searchClient = algoliasearch(APP_ID, SEARCH_KEY);

export const ALGOLIA_INDEX = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || 'Shadow_Merchant';
