import logging
from datetime import datetime
from .database import db

log = logging.getLogger(__name__)


def upsert_user(user_id: str, email: str = None):
    """Create user if not exists, update last_login if exists."""
    with db() as cursor:
        cursor.execute("""
            INSERT INTO users (id, email, created_at, last_login)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                last_login = VALUES(last_login),
                email      = COALESCE(VALUES(email), email)
        """, (user_id, email, datetime.utcnow(), datetime.utcnow()))


def get_user(user_id: str) -> dict | None:
    with db() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        return cursor.fetchone()