const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://Shadow_Merchant_db:a3IiIkQMecHpUEZi@cluster0.fjnmtcq.mongodb.net/shadowmerchant?appName=Cluster0';
const CLERK_ID = 'user_3Bj88JeUnX6QrK7Eeuers0u56La';

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to production cluster');

  const db = client.db('shadowmerchant');
  const col = db.collection('users');

  // First check what exists
  const before = await col.findOne({ clerk_id: CLERK_ID });
  console.log('Before:', JSON.stringify({ found: !!before, tier: before?.subscription_tier, email: before?.email }));

  // Update
  const result = await col.findOneAndUpdate(
    { clerk_id: CLERK_ID },
    { $set: { subscription_tier: 'pro', subscription_status: 'active' } },
    { returnDocument: 'after' }
  );

  console.log('After:', JSON.stringify({
    matched:   !!result,
    tier:      result?.subscription_tier,
    status:    result?.subscription_status,
    clerk_id:  result?.clerk_id,
    email:     result?.email,
  }));

  await client.close();
}

run().catch(console.error);
