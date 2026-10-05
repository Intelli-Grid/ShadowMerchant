/**
 * One-time fix: upsert a user into MongoDB with Pro tier.
 * Reads MONGODB_URI from environment — NO credentials in source.
 *
 * Steps:
 * 1. Go to https://dashboard.clerk.com → Users → find the target user
 * 2. Copy their user_XXXX ID
 * 3. Run:
 *    MONGODB_URI=<uri> CLERK_ID=<clerk_id> node scripts/fix_smokapubg.js
 *    Or set MONGODB_URI in scripts/.env before running.
 */
require('dotenv').config({ path: '.env' });

const { MongoClient } = require('mongodb');

const URI      = process.env.MONGODB_URI;
const CLERK_ID = process.env.CLERK_ID || 'PASTE_CLERK_ID_HERE';
const EMAIL    = process.env.USER_EMAIL || 'smokapubg@gmail.com';

if (!URI) {
  console.error('❌  MONGODB_URI environment variable is required.');
  process.exit(1);
}

if (CLERK_ID === 'PASTE_CLERK_ID_HERE') {
  console.error('❌  Set CLERK_ID env var before running this script.');
  process.exit(1);
}

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('✅  Connected to MongoDB');

  const col = client.db('shadowmerchant').collection('users');

  const existing = await col.findOne({ clerk_id: CLERK_ID });
  console.log('Existing record:', existing
    ? { email: existing.email, tier: existing.subscription_tier }
    : 'NOT FOUND — will create'
  );

  const result = await col.findOneAndUpdate(
    { clerk_id: CLERK_ID },
    {
      $set: {
        clerk_id: CLERK_ID,
        email: EMAIL,
        subscription_tier: 'pro',
        subscription_status: 'active',
        updated_at: new Date(),
      },
      $setOnInsert: {
        created_at: new Date(),
        wishlist: [],
        name: EMAIL.split('@')[0],
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('\n✅  Done:', {
    email:    result?.email    ?? EMAIL,
    tier:     result?.subscription_tier,
    status:   result?.subscription_status,
    clerk_id: result?.clerk_id,
  });

  await client.close();
}

run().catch((err) => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
