import json
import logging
from datetime import datetime
from .database import db

log = logging.getLogger(__name__)


def save_attack_paths(scan_id: str, user_id: str, paths: list):
    """Save all attack paths for a completed scan."""
    if not paths:
        return
    with db() as cursor:
        # Clear any existing paths for this scan first
        cursor.execute("DELETE FROM attack_paths WHERE scan_id = %s", (scan_id,))
        for path in paths:
            cursor.execute("""
                INSERT INTO attack_paths
                    (scan_id, user_id, target_name, target_type, score,
                     exploitability, hop_count, blast_radius, ai_narrative, hops_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                scan_id,
                user_id,
                path.get("target_name", ""),
                path.get("target_type", ""),
                path.get("score", 0.0),
                path.get("exploitability", "LOW"),
                path.get("hop_count", 0),
                path.get("blast_radius", 0.0),
                path.get("ai_narrative", ""),
                json.dumps(path.get("hops", [])),
            ))


def get_attack_paths(scan_id: str) -> list:
    with db() as cursor:
        cursor.execute("""
            SELECT * FROM attack_paths
            WHERE scan_id = %s
            ORDER BY score ASC
        """, (scan_id,))
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get("hops_json"), str):
                row["hops"] = json.loads(row["hops_json"])
            elif isinstance(row.get("hops_json"), (list, dict)):
                row["hops"] = row["hops_json"]
            else:
                row["hops"] = []
            # Remove raw JSON column from response
            row.pop("hops_json", None)
            if row.get("created_at") and isinstance(row["created_at"], datetime):
                row["created_at"] = row["created_at"].isoformat()
        return rows


def get_paths_by_severity(user_id: str, exploitability: str) -> list:
    """Get all paths of a given severity across all scans for a user."""
    with db() as cursor:
        cursor.execute("""
            SELECT ap.*, s.completed_at as scan_date
            FROM attack_paths ap
            JOIN scans s ON ap.scan_id = s.id
            WHERE ap.user_id = %s AND ap.exploitability = %s
            ORDER BY ap.score ASC
        """, (user_id, exploitability))
        return cursor.fetchall()