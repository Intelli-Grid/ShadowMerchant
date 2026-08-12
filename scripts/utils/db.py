import os
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Module-level singleton — ONE MongoClient per process.
# MongoClient maintains an internal connection pool internally (maxPoolSize).
# Creating a new MongoClient on every get_db() call was exhausting Atlas
# connection limits: scrapers loop over 12+ categories, each calling get_db().
_client: MongoClient | None = None

def get_db():
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI")
        if not uri:
            raise EnvironmentError(
                "MONGODB_URI is not set. Add it to scripts/.env or the environment."
            )
        try:
            _client = MongoClient(
                uri,
                maxPoolSize=10,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=30000,
            )
            # Validate connection immediately — fail fast on bad URI
            _client.admin.command('ping')
            logging.info("[db] MongoDB connection established")
        except Exception as e:
            _client = None  # allow retry on next call
            logging.error(f"[db] Failed to connect to MongoDB: {e}")
            raise
    return _client.shadowmerchant

