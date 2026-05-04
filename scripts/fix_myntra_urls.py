import os
import pymongo
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
client = pymongo.MongoClient(os.getenv('MONGODB_URI'))
db = client.shadowmerchant

count_affiliate = 0
count_product = 0

for d in db.deals.find({'source_platform': 'myntra'}):
    update_fields = {}
    
    if 'affiliate_url' in d and '/product/' in d['affiliate_url']:
        update_fields['affiliate_url'] = d['affiliate_url'].replace('/product/', '/')
        count_affiliate += 1
        
    if 'product_url' in d and '/product/' in d['product_url']:
        update_fields['product_url'] = d['product_url'].replace('/product/', '/')
        count_product += 1
        
    if update_fields:
        db.deals.update_one({'_id': d['_id']}, {'$set': update_fields})

print(f"Fixed affiliate URLs: {count_affiliate}")
print(f"Fixed product URLs: {count_product}")
