import os
import pymongo
from dotenv import load_dotenv
import datetime

load_dotenv(os.path.join(os.getcwd(), 'apps/web/.env.local'))
uri = os.getenv('MONGODB_URI')
if not uri:
    load_dotenv('.env')
    uri = os.getenv('MONGODB_URI')
    
client = pymongo.MongoClient(uri)
db = client.get_database()

updated = db['deals'].update_many({}, {'$set': {'is_active': True}})
print('Reactivated:', updated.modified_count)

top_deals = db['deals'].find({'deal_score': {'$gte': 1}, 'is_active': True}).sort('deal_score', -1).limit(8)
for deal in top_deals:
    db['deals'].update_one(
        {'_id': deal['_id']}, 
        {'$set': {
            'is_trending': True, 
            'created_at': datetime.datetime.utcnow(), 
            'scraped_at': datetime.datetime.utcnow()
        }}
    )
print('Set Top 8 to Trending and New')
