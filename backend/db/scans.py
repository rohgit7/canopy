import json
import logging
from datetime import datetime
from .database import db

log = logging.getLogger(__name__)


def create_scan(scan_id: str, user_id: str, role_arn: str = None, account_id: str = None):
    with db() as cursor:
        cursor.execute("""
            INSERT INTO scans (id, user_id, role_arn, account_id, status, started_at)
            VALUES (%s, %s, %s, %s, 'running', %s)
        """, (scan_id, user_id, role_arn, account_id, datetime.utcnow()))


def update_scan_running(scan_id: str, resource_count: int):
    with db() as cursor:
        cursor.execute("""
            UPDATE scans SET resource_count = %s WHERE id = %s
        """, (resource_count, scan_id))


def complete_scan(scan_id: str, score: float, resource_count: int,
                  node_count: int, edge_count: int):
    with db() as cursor:
        cursor.execute("""
            UPDATE scans SET
                status         = 'complete',
                score          = %s,
                resource_count = %s,
                node_count     = %s,
                edge_count     = %s,
                completed_at   = %s
            WHERE id = %s
        """, (score, resource_count, node_count, edge_count, datetime.utcnow(), scan_id))


def fail_scan(scan_id: str, error: str):
    with db() as cursor:
        cursor.execute("""
            UPDATE scans SET
                status       = 'failed',
                error        = %s,
                completed_at = %s
            WHERE id = %s
        """, (error[:1000], datetime.utcnow(), scan_id))


def get_scan(scan_id: str) -> dict | None:
    with db() as cursor:
        cursor.execute("SELECT * FROM scans WHERE id = %s", (scan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        # Datetime objects need to be serialised to string for JSON responses
        for field in ("started_at", "completed_at"):
            if row.get(field) and isinstance(row[field], datetime):
                row[field] = row[field].isoformat()
        return row


def get_latest_scan(user_id: str) -> dict | None:
    with db() as cursor:
        cursor.execute("""
            SELECT * FROM scans
            WHERE user_id = %s AND status = 'complete'
            ORDER BY completed_at DESC
            LIMIT 1
        """, (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        for field in ("started_at", "completed_at"):
            if row.get(field) and isinstance(row[field], datetime):
                row[field] = row[field].isoformat()
        return row


def get_scan_history(user_id: str, limit: int = 20) -> list:
    with db() as cursor:
        cursor.execute("""
            SELECT id, status, score, resource_count, node_count,
                   edge_count, started_at, completed_at, error
            FROM scans
            WHERE user_id = %s
            ORDER BY started_at DESC
            LIMIT %s
        """, (user_id, limit))
        rows = cursor.fetchall()
        for row in rows:
            for field in ("started_at", "completed_at"):
                if row.get(field) and isinstance(row[field], datetime):
                    row[field] = row[field].isoformat()
        return rows