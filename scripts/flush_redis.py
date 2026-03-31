import os
import requests

env_path = os.path.join(os.path.dirname(__file__), '..', 'apps', 'web', '.env.local')

url = ''
token = ''

with open(env_path, 'r') as f:
    for line in f:
        if line.startswith('UPSTASH_REDIS_REST_URL='):
            url = line.split('=', 1)[1].strip().strip('"').strip("'")
        elif line.startswith('UPSTASH_REDIS_REST_TOKEN='):
            token = line.split('=', 1)[1].strip().strip('"').strip("'")

if url and token:
    res = requests.post(f"{url}/FLUSHALL", headers={"Authorization": f"Bearer {token}"})
    print("Redis flushed:", res.json())
else:
    print("Could not find Redis credentials in .env.local")
