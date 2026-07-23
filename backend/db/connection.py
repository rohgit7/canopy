import os
import logging
from pymongo import MongoClient
from pymongo.database import Database
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = os.environ.get(
            "MONGODB_URI",
            "mongodb://canopy_user:CanopyMongo2026$@localhost:27017/canopy?authSource=canopy"
        )
        _client = MongoClient(
            uri,
            serverSelectionTimeoutMS = 5000,   # fail fast if mongo is down
            connectTimeoutMS         = 5000,
            maxPoolSize              = 10,
        )
    return _client


def get_db() -> Database:
    db_name = os.environ.get("MONGODB_DATABASE", "canopy")
    return get_client()[db_name]


def ping() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception as e:
        log.error(f"MongoDB ping failed: {e}")
        return False