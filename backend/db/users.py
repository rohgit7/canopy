import logging
from datetime import datetime
from .connection import get_db

log = logging.getLogger(__name__)


def upsert_user(user_id: str, email: str = ""):
    """
    Insert the user document if it does not exist.
    Update last_seen and email if it does.
    upsert=True means: insert if no match, update if match found.
    """
    db = get_db()
    db.users.update_one(
        filter = {"user_id": user_id},
        update = {
            "$set": {
                "last_seen": datetime.utcnow(),
                **({"email": email} if email else {}),
            },
            "$setOnInsert": {
                "user_id":    user_id,
                "created_at": datetime.utcnow(),
            },
        },
        upsert = True,
    )


def get_user(user_id: str) -> dict | None:
    db  = get_db()
    doc = db.users.find_one({"user_id": user_id}, {"_id": 0})
    return doc