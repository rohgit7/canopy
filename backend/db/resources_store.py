import logging
from datetime import datetime
from .database import db

log = logging.getLogger(__name__)


def save_resources(scan_id: str, user_id: str, resources: list):
    if not resources:
        return
    with db() as cursor:
        cursor.execute("DELETE FROM resources WHERE scan_id = %s", (scan_id,))
        for r in resources:
            rdict = r.to_dict() if hasattr(r, "to_dict") else r
            cursor.execute("""
                INSERT INTO resources
                    (scan_id, user_id, resource_id, resource_type, name,
                     arn, region, internet_facing, is_sensitive, is_admin)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                scan_id,
                user_id,
                rdict.get("resource_id", ""),
                rdict.get("resource_type", ""),
                rdict.get("name", ""),
                rdict.get("arn", ""),
                rdict.get("region", ""),
                bool(rdict.get("internet_facing", False)),
                bool(rdict.get("is_sensitive", False)),
                bool(rdict.get("metadata", {}).get("is_admin", False)),
            ))


def get_resources(scan_id: str) -> list:
    with db() as cursor:
        cursor.execute("""
            SELECT * FROM resources WHERE scan_id = %s
        """, (scan_id,))
        return cursor.fetchall()