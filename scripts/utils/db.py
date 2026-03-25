import os
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_db():
    uri = os.getenv("MONGODB_URI")
    if not uri:
        logging.error("MONGODB_URI not set.")
        return None
    try:
        client = MongoClient(uri)
        return client.shadowmerchant
    except Exception as e:
        logging.error(f"Failed to connect to MongoDB: {e}")
        return None
