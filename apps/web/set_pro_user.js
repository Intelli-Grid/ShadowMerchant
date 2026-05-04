const { MongoClient } = require('mongodb');

const URI      = 'mongodb+srv://Shadow_Merchant_db:a3IiIkQMecHpUEZi@cluster0.fjnmtcq.mongodb.net/shadowmerchant?appName=Cluster0';
const CLERK_ID = 'user_3Bkcmg8w13wmEQBU2PFveB2UUBf'; // smokapubg@gmail.com

async function run() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB');

  const col = client.db('shadowmerchant').collection('users');

  const before = await col.findOne({ clerk_id: CLERK_ID });
  console.log('Before:', JSON.stringify({ found: !!before, tier: before?.subscription_tier, email: before?.email }));

  const result = await col.findOneAndUpdate(
    { clerk_id: CLERK_ID },
    { $set: { email: 'smokapubg@gmail.com', subscription_tier: 'pro', subscription_status: 'active', updated_at: new Date() } },
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
