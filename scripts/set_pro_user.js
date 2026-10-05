/**
 * One-time admin utility: promote a user to Pro tier by Clerk ID.
 * Reads MONGODB_URI from environment — NO credentials in source.
 *
 * Usage:
 *   MONGODB_URI=<uri> CLERK_ID=<clerk_id> USER_EMAIL=<email> node set_pro_user.js
 *
 * Or set MONGODB_URI in scripts/.env and run from the scripts/ directory.
 */
require('dotenv').config({ path: '.env' });

const { MongoClient } = require('mongodb');

const URI      = process.env.MONGODB_URI;
const CLERK_ID = process.env.CLERK_ID || 'user_3Bkcmg8w13wmEQBU2PFveB2UUBf';
const EMAIL    = process.env.USER_EMAIL || 'smokapubg@gmail.com';

if (!URI) {
  console.error('ERROR: MONGODB_URI environment variable is required.');
  console.error('Set it in scripts/.env or pass it inline: MONGODB_URI=<uri> node set_pro_user.js');
  process.exit(1);
}

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB');

  const col = client.db('shadowmerchant').collection('users');

  const before = await col.findOne({ clerk_id: CLERK_ID });
  console.log('Before:', JSON.stringify({ found: !!before, tier: before?.subscription_tier, email: before?.email }));

  const result = await col.findOneAndUpdate(
    { clerk_id: CLERK_ID },
    { $set: { email: EMAIL, subscription_tier: 'pro', subscription_status: 'active', updated_at: new Date() } },
    { returnDocument: 'after' }
  );

  console.log('After:', JSON.stringify({
    matched:  !!result,
    tier:     result?.subscription_tier,
    status:   result?.subscription_status,
    email:    result?.email,
    clerk_id: result?.clerk_id,
  }));

  await client.close();
}

run().catch(console.error);
