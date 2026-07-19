import logging
from datetime import datetime
from .database import db

log = logging.getLogger(__name__)


def save_connection(user_id: str, role_arn: str, account_id: str):
    with db() as cursor:
        cursor.execute("""
            INSERT INTO connections (user_id, role_arn, account_id, connected_at, last_verified, is_active)
            VALUES (%s, %s, %s, %s, %s, TRUE)
            ON DUPLICATE KEY UPDATE
                account_id    = VALUES(account_id),
                last_verified = VALUES(last_verified),
                is_active     = TRUE
        """, (user_id, role_arn, account_id, datetime.utcnow(), datetime.utcnow()))


def get_connection(user_id: str) -> dict | None:
    with db() as cursor:
        cursor.execute("""
            SELECT * FROM connections
            WHERE user_id = %s AND is_active = TRUE
            ORDER BY last_verified DESC
            LIMIT 1
        """, (user_id,))
        return cursor.fetchone()


def get_role_arn(user_id: str) -> str | None:
    conn = get_connection(user_id)
    return conn["role_arn"] if conn else None


def deactivate_connection(user_id: str):
    with db() as cursor:
        cursor.execute("""
            UPDATE connections SET is_active = FALSE
            WHERE user_id = %s
        """, (user_id,))