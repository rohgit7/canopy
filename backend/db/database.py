import mysql.connector
import os
import logging
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host":     os.environ.get("MYSQL_HOST",     "localhost"),
    "port":     int(os.environ.get("MYSQL_PORT", "3306")),
    "user":     os.environ.get("MYSQL_USER",     "canopy_user"),
    "password": os.environ.get("MYSQL_PASSWORD", "canopy_password_2025"),
    "database": os.environ.get("MYSQL_DATABASE", "canopy"),
    "charset":  "utf8mb4",
}


def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


@contextmanager
def db():
    """Context manager — auto-commits on success, rolls back on error."""
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"DB error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def ping() -> bool:
    """Verify database connection is working."""
    try:
        with db() as cursor:
            cursor.execute("SELECT 1")
        return True
    except Exception:
        return False    