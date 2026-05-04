/**
 * Syncs the Pro tier to Clerk publicMetadata for smokapubg@gmail.com.
 * Run with: node apps/web/sync_clerk_meta.js
 *
 * Requires CLERK_SECRET_KEY in env — reads from apps/web/.env.local
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const { createClerkClient } = require('@clerk/backend');

const CLERK_ID = 'user_3Bkcmg8w13wmEQBU2PFveB2UUBf'; // smokapubg@gmail.com

async function run() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  // Fetch existing metadata first (safe merge)
  const user = await clerk.users.getUser(CLERK_ID);
  const existing = user.publicMetadata || {};
  console.log('Existing publicMetadata:', existing);

  await clerk.users.updateUserMetadata(CLERK_ID, {
    publicMetadata: { ...existing, tier: 'pro' },
  });

  console.log('✅ Clerk publicMetadata updated → tier: pro');
}

run().catch(console.error);
