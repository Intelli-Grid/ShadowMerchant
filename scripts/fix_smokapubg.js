/**
 * One-time fix: upsert smokapubg@gmail.com into MongoDB with Pro tier.
 *
 * Steps:
 * 1. Go to https://dashboard.clerk.com → Users → search smokapubg@gmail.com
 * 2. Copy their user_XXXX ID and paste it below as CLERK_ID
 * 3. Run: node scripts/fix_smokapubg.js
 */
const { MongoClient } = require('mongodb');

const URI      = 'mongodb+srv://Shadow_Merchant_db:a3IiIkQMecHpUEZi@cluster0.fjnmtcq.mongodb.net/shadowmerchant?appName=Cluster0';
const CLERK_ID = 'PASTE_CLERK_ID_HERE';   // ← REPLACE THIS
const EMAIL    = 'smokapubg@gmail.com';

if (CLERK_ID === 'PASTE_CLERK_ID_HERE') {
  console.error('❌  Set CLERK_ID before running this script.');
  process.exit(1);
}

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('✅  Connected to MongoDB');

  const col = client.db('shadowmerchant').collection('users');

  // Check if record already exists
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
        name: 'smokapubg',
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
