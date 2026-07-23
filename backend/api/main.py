import asyncio
import logging
import os
import uuid
from datetime import datetime

import boto3
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ── DB ────────────────────────────────────────────────────────────────────────
from ..db.connection import ping
from ..db.users      import upsert_user
from ..db.connections import save_connection, get_role_arn, get_connection
from ..db.scans      import (
    create_scan,
    update_resource_count,
    complete_scan,
    fail_scan,
    get_scan,
    get_latest_complete_scan,
    get_scan_history,
)

from ..extractor.orchestrator import extract_all
from ..extractor.policies      import PolicyDocExtractor
from ..graph.builder           import build_graph
from ..engine.attack_paths     import AttackPathEngine
from ..engine.blast_radius     import BlastRadiusCalculator
from ..ai.narrator             import narrate_path



app = FastAPI(title="Canopy API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins     = [
        "http://localhost:3000",
        os.environ.get("FRONTEND_URL", "https://canopy.vercel.app"),
    ],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


class ConnectRequest(BaseModel):
    role_arn:    str
    customer_id: str = "default"


class ScanRequest(BaseModel):
    customer_id: str = "default"


@app.get("/health")
async def health():
    db_ok = ping()
    
    return {"status": "ok" if db_ok else "degraded", "version": "2.0.0", "database": "connected" if db_ok else "unreachable",}


@app.post("/connect")
async def connect_account(req: ConnectRequest):
    try:
        sts   = boto3.client("sts")
        creds = sts.assume_role(
            RoleArn         = req.role_arn,
            RoleSessionName = "CanopyVerify",
            DurationSeconds = 900,
        )["Credentials"]

        test_session = boto3.Session(
            aws_access_key_id     = creds["AccessKeyId"],
            aws_secret_access_key = creds["SecretAccessKey"],
            aws_session_token     = creds["SessionToken"],
        )
        account_id = test_session.client("sts").get_caller_identity()["Account"]

        upsert_user(req.customer_id)
        save_connection(req.customer_id, req.role_arn, account_id)
        return {
            "status":     "connected",
            "account_id": account_id,
            "role_arn":   req.role_arn,
        }
    except Exception as e:
        raise HTTPException(400, f"Cannot assume role: {e}")


@app.get("/connection/{customer_id}")
async def get_connection_status(customer_id: str):
    conn = get_connection(customer_id)
    if not conn:
        return {"status": "not_connected"}
    return _serialise(conn)



@app.post("/scan")
async def start_scan(req: ScanRequest, bg: BackgroundTasks):
    upsert_user(req.customer_id)
    
    role_arn = get_role_arn(req.customer_id)
    scan_id  = str(uuid.uuid4())[:8]

    create_scan(scan_id, req.customer_id)

    bg.add_task(_run_scan, scan_id, role_arn, req.customer_id)
    return {"scan_id": scan_id, "status": "running"}


@app.get("/scan/{scan_id}")
async def get_scan_result(scan_id: str):
    doc = get_scan(scan_id)
    if not doc:
        raise HTTPException(404, "Scan not found")

    # Convert datetime objects to strings for JSON
    return _serialise(doc)


def _get_latest_scan_id(customer_id: str):
    return _latest_scans_by_customer.get(customer_id)


@app.get("/dashboard/{customer_id}")
async def get_dashboard(customer_id: str):
    doc = get_latest_complete_scan(customer_id)
    if not doc:
        return {"status": "no_scan", "message": "Run a scan first"}
    return _serialise(doc)

@app.get("/scans/{customer_id}")
async def list_scans(customer_id: str):
    history = get_scan_history(customer_id)
    return [_serialise(s) for s in history]


async def _run_scan(scan_id: str, role_arn: str, customer_id: str):
    try:
        log.info(f"[{scan_id}] Starting scan")

        resources = await asyncio.get_event_loop().run_in_executor(
            None, extract_all, role_arn
        )
        update_resource_count(scan_id, len(resources))
        log.info(f"[{scan_id}] {len(resources)} resources extracted")

        session  = _get_session(role_arn) if role_arn else boto3.Session()
        pol_arns = list(set(
            arn
            for r in resources
            for arn in r.metadata.get("attached_policies", [])
        ))

        policies = PolicyDocExtractor(session).extract_docs(pol_arns)

        graph   = build_graph(customer_id, resources, policies)
        log.info(
            f"[{scan_id}] Graph: {graph.G.number_of_nodes()} nodes "
            f"{graph.G.number_of_edges()} edges"
        )
        paths   = AttackPathEngine(graph).find_all()
        log.info(f"[{scan_id}] {len(paths)} attack paths")
        blast_c = BlastRadiusCalculator(graph)

        for p in paths:
            p.blast_radius = blast.calculate(p.target_id).score

        # 6. AI narration
        for p in [x for x in paths if x.exploitability == "CRITICAL"][:3]:
            try:
                p.ai_narrative = narrate_path(p)
            except Exception as e:
                log.warning(f"[{scan_id}] Narration failed: {e}")

        deductions = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 8, "LOW": 3}
        score      = max(0.0, 100.0 - sum(
            deductions.get(p.exploitability, 0) for p in paths
        ))

        complete_scan(
            scan_id        = scan_id,
            score          = score,
            resource_count = len(resources),
            node_count     = graph.G.number_of_nodes(),
            edge_count     = graph.G.number_of_edges(),
            attack_paths   = [p.to_dict() for p in paths],
            graph_data     = _to_d3(graph),
        )
        log.info(f"[{scan_id}] Done — score={score:.1f}")

    except Exception as e:
        log.exception(f"[{scan_id}] Failed: {e}")
        fail_scan(scan_id, str(e))



def _get_session(role_arn: str):
    sts   = boto3.client("sts")
    creds = sts.assume_role(
        RoleArn         = role_arn,
        RoleSessionName = "CanopyScan",
    )["Credentials"]
    return boto3.Session(
        aws_access_key_id     = creds["AccessKeyId"],
        aws_secret_access_key = creds["SecretAccessKey"],
        aws_session_token     = creds["SessionToken"],
    )


def _to_d3(graph) -> dict:
    nodes = [
        {
            "id":              nid,
            "name":            d.get("name", nid),
            "type":            d.get("resource_type", "unknown"),
            "internet_facing": d.get("internet_facing", False),
            "is_sensitive":    d.get("is_sensitive", False),
            "is_admin":        d.get("is_admin", False),
            "region":          d.get("region", ""),
        }
        for nid, d in graph.G.nodes(data=True)
    ]
    links = [
        {
            "source":    s,
            "target":    t,
            "edge_type": d.get("edge_type", ""),
            "weight":    d.get("weight", 0.5),
        }
        for s, t, d in graph.G.edges(data=True)
    ]
    return {"nodes": nodes, "links": links}

def _serialise(doc: dict) -> dict:
    """
    Convert MongoDB document to JSON-serialisable dict.
    MongoDB returns datetime objects — FastAPI cannot serialise those directly.
    """
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            iso = v.isoformat()
            out[k] = iso if iso.endswith("Z") or "+" in iso else f"{iso}Z"
        else:
            out[k] = v
    return out


handler = Mangum(app)