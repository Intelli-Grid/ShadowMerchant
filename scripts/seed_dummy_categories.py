import os
import sys
import uuid
import pymongo
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("Error: MONGO_URI not found in .env")
    sys.exit(1)

client = pymongo.MongoClient(MONGO_URI)
db = client.shadowmerchant

categories_to_seed = [
    ('home', 'Prestige Iris 750 Watt Mixer Grinder', 'amazon', 3999, 2999, 'https://amazon.in', 'https://m.media-amazon.com/images/I/41-lSroXUGL.jpg'),
    ('sports', 'Nivia Storm Football', 'amazon', 599, 399, 'https://amazon.in', 'https://m.media-amazon.com/images/I/81xXn+vV7mL._SX679_.jpg'),
    ('books', 'Atomic Habits by James Clear', 'flipkart', 799, 499, 'https://flipkart.com', 'https://m.media-amazon.com/images/I/91bYsX41DVL._AC_UY327_FMwebp_QL65_.jpg'),
    ('toys', 'Hot Wheels 5-Car Pack', 'amazon', 749, 499, 'https://amazon.in', 'https://m.media-amazon.com/images/I/71I2h1H1Z1L._SX679_.jpg'),
    ('health', 'Optimum Nutrition Gold Standard Whey', 'nykaa', 3599, 2999, 'https://nykaa.com', 'https://m.media-amazon.com/images/I/61bVvMhV9tL._SX679_.jpg'),
    ('automotive', 'Portonics Auto 10 Smart Car Charger', 'amazon', 1999, 999, 'https://amazon.in', 'https://m.media-amazon.com/images/I/51A334Ww4pL._SX679_.jpg'),
    ('grocery', 'Tata Simply Better Cold Pressed Olive Oil', 'amazon', 1199, 799, 'https://amazon.in', 'https://m.media-amazon.com/images/I/51tL0qL7lKL._SX679_.jpg'),
    ('travel', 'Safari Ray Polycarbonate Cabin Suitcase', 'flipkart', 4999, 1999, 'https://flipkart.com', 'https://m.media-amazon.com/images/I/61I2o811d-L._UY879_.jpg'),
    ('gaming', 'Cosmic Byte G4000 Gaming Headset', 'amazon', 1999, 1199, 'https://amazon.in', 'https://m.media-amazon.com/images/I/61pBvlYfO5L._SX679_.jpg')
]

inserted = 0
for cat, title, platform, orig, disc, url, img in categories_to_seed:
    discount_pct = int(round((1 - disc / orig) * 100))
    doc = {
        "deal_id": str(uuid.uuid4()),
        "title": title,
        "source_platform": platform,
        "original_price": orig,
        "discounted_price": disc,
        "discount_percent": discount_pct,
        "deal_score": 60 + discount_pct,
        "affiliate_url": url,
        "image_url": img,
        "category": cat,
        "is_active": True,
        "is_pro_exclusive": False,
        "scraped_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "price_history": [{
            "date": datetime.now(timezone.utc),
            "price": disc
        }]
    }
    # Insert if category doesn't have an active dummy deal
    exists = db.deals.find_one({"category": cat, "title": title, "is_active": True})
    if not exists:
        db.deals.insert_one(doc)
        inserted += 1

print(f"✅ Successfully seeded {inserted} dummy deals into missing categories.")
client.close()
