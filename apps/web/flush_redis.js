const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables manually
const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const url = process.env.UPSTASH_REDIS_REST_URL + '/FLUSHALL';
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.json())
  .then(data => {
    console.log("Redis flush result:", data);
  })
  .catch(err => {
    console.error("Redis flush error:", err);
  });
