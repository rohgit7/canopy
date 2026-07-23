import logging
from datetime import datetime
from .connection import get_db

log = logging.getLogger(__name__)


def save_connection(user_id: str, role_arn: str, account_id: str):
    """
    Store the AWS role ARN for a user.
    One connection document per user — overwrite if they reconnect with a new ARN.
    """
    db = get_db()
    db.connections.update_one(
        filter = {"user_id": user_id},
        update = {
            "$set": {
                "role_arn":     role_arn,
                "account_id":   account_id,
                "connected_at": datetime.utcnow(),
            },
            "$setOnInsert": {
                "user_id": user_id,
            },
        },
        upsert = True,
    )


def get_role_arn(user_id: str) -> str | None:
    db  = get_db()
    doc = db.connections.find_one(
        {"user_id": user_id},
        {"role_arn": 1, "_id": 0}
    )
    return doc["role_arn"] if doc else None


def get_connection(user_id: str) -> dict | None:
    db = get_db()
    return db.connections.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )