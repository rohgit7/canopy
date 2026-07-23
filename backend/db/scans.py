import logging
from datetime import datetime
from .connection import get_db

log = logging.getLogger(__name__)


def _clean(doc: dict | None) -> dict | None:
    """Remove MongoDB's internal _id field before returning."""
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc


def create_scan(scan_id: str, user_id: str):
    """
    Insert a minimal scan document with status=running.
    The rest of the fields are added when the scan completes.
    """
    db = get_db()
    db.scans.insert_one({
        "scan_id":    scan_id,
        "user_id":    user_id,
        "status":     "running",
        "started_at": datetime.utcnow(),
    })


def update_resource_count(scan_id: str, count: int):
    db = get_db()
    db.scans.update_one(
        {"scan_id": scan_id},
        {"$set": {"resource_count": count}},
    )


def complete_scan(
    scan_id:        str,
    score:          float,
    resource_count: int,
    node_count:     int,
    edge_count:     int,
    attack_paths:   list,
    graph_data:     dict,
):
    """
    Store the complete scan result in one document.
    Attack paths and graph data are embedded — no separate collections needed.
    This is the core MongoDB advantage: everything in one place.
    """
    db = get_db()
    db.scans.update_one(
        {"scan_id": scan_id},
        {"$set": {
            "status":         "complete",
            "score":          round(score, 1),
            "resource_count": resource_count,
            "node_count":     node_count,
            "edge_count":     edge_count,
            "attack_paths":   attack_paths,
            "graph_data":     graph_data,
            "completed_at":   datetime.utcnow(),
        }},
    )


def fail_scan(scan_id: str, error: str):
    db = get_db()
    db.scans.update_one(
        {"scan_id": scan_id},
        {"$set": {
            "status":       "failed",
            "error":        str(error)[:2000],
            "completed_at": datetime.utcnow(),
        }},
    )


def get_scan(scan_id: str) -> dict | None:
    db  = get_db()
    doc = db.scans.find_one({"scan_id": scan_id})
    return _clean(doc)


def get_latest_complete_scan(user_id: str) -> dict | None:
    """Return the most recently completed scan for this user."""
    db  = get_db()
    doc = db.scans.find_one(
        {"user_id": user_id, "status": "complete"},
        sort=[("completed_at", -1)],   # -1 means descending — newest first
    )
    return _clean(doc)


def get_scan_history(user_id: str, limit: int = 10) -> list:
    """
    Return scan history without the heavy fields.
    Projection excludes attack_paths and graph_data so this is fast
    even when those fields are large.
    """
    db   = get_db()
    docs = db.scans.find(
        {"user_id": user_id},
        {
            "_id":           0,
            "attack_paths":  0,   # exclude — too large for list view
            "graph_data":    0,   # exclude — too large for list view
        },
        sort  = [("started_at", -1)],
        limit = limit,
    )
    return list(docs)