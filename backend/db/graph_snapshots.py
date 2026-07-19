import json
import logging
from datetime import datetime
from .database import db

log = logging.getLogger(__name__)


def save_graph(scan_id: str, user_id: str, graph_data: dict):
    nodes_json = json.dumps(graph_data.get("nodes", []))
    links_json = json.dumps(graph_data.get("links", []))
    with db() as cursor:
        cursor.execute("""
            INSERT INTO graph_snapshots (scan_id, user_id, nodes_json, links_json)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                nodes_json = VALUES(nodes_json),
                links_json = VALUES(links_json)
        """, (scan_id, user_id, nodes_json, links_json))


def get_graph(scan_id: str) -> dict | None:
    with db() as cursor:
        cursor.execute("""
            SELECT nodes_json, links_json FROM graph_snapshots
            WHERE scan_id = %s
        """, (scan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "nodes": json.loads(row["nodes_json"]) if isinstance(row["nodes_json"], str) else row["nodes_json"],
            "links": json.loads(row["links_json"]) if isinstance(row["links_json"], str) else row["links_json"],
        }