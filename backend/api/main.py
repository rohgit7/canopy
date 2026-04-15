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

from ..extractor.orchestrator import extract_all
from ..extractor.policies      import PolicyDocExtractor
from ..graph.builder           import build_graph
from ..engine.attack_paths     import AttackPathEngine
from ..engine.blast_radius     import BlastRadiusCalculator
from ..ai.narrator             import narrate_path

_scans:       dict = {}
_connections: dict = {}

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
    return {"status": "ok", "version": "2.0.0"}


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
        identity   = test_session.client("sts").get_caller_identity()
        account_id = identity["Account"]

        _connections[req.customer_id] = req.role_arn
        return {
            "status":     "connected",
            "account_id": account_id,
            "role_arn":   req.role_arn,
        }
    except Exception as e:
        raise HTTPException(400, f"Cannot assume role: {e}")


@app.post("/scan")
async def start_scan(req: ScanRequest, bg: BackgroundTasks):
    role_arn = _connections.get(req.customer_id)
    scan_id  = str(uuid.uuid4())[:8]

    _scans[scan_id] = {
        "status":      "running",
        "customer_id": req.customer_id,
        "started_at":  datetime.utcnow().isoformat(),
    }

    bg.add_task(_run_scan, scan_id, role_arn, req.customer_id)
    return {"scan_id": scan_id, "status": "running"}


@app.get("/scan/{scan_id}")
async def get_scan(scan_id: str):
    if scan_id not in _scans:
        raise HTTPException(404, "Scan not found")
    return _scans[scan_id]


@app.get("/dashboard/{customer_id}")
async def get_dashboard(customer_id: str):
    completed = [
        s for s in _scans.values()
        if s.get("customer_id") == customer_id
        and s.get("status") == "complete"
    ]
    if not completed:
        return {"status": "no_scan", "message": "Run a scan first"}
    return completed[-1]


async def _run_scan(scan_id: str, role_arn: str, customer_id: str):
    try:
        log.info(f"[{scan_id}] Starting scan")

        resources = await asyncio.get_event_loop().run_in_executor(
            None, extract_all, role_arn
        )
        _scans[scan_id]["resource_count"] = len(resources)

        session  = _get_session(role_arn) if role_arn else boto3.Session()
        pol_arns = []
        for r in resources:
            pol_arns.extend(r.metadata.get("attached_policies", []))

        policies = PolicyDocExtractor(session).extract_docs(list(set(pol_arns)))

        graph   = build_graph(customer_id, resources, policies)
        paths   = AttackPathEngine(graph).find_all()
        blast_c = BlastRadiusCalculator(graph)

        for path in paths:
            path.blast_radius = blast_c.calculate(path.target_id).score

        for path in [p for p in paths if p.exploitability == "CRITICAL"][:3]:
            try:
                path.ai_narrative = narrate_path(path)
            except Exception as e:
                log.warning(f"Narration failed: {e}")

        deductions = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 8, "LOW": 3}
        score      = max(0.0, 100.0 - sum(
            deductions.get(p.exploitability, 0) for p in paths
        ))

        _scans[scan_id].update({
            "status":         "complete",
            "score":          round(score, 1),
            "resource_count": len(resources),
            "node_count":     graph.G.number_of_nodes(),
            "edge_count":     graph.G.number_of_edges(),
            "attack_paths":   [p.to_dict() for p in paths],
            "graph_data":     _to_d3(graph),
            "completed_at":   datetime.utcnow().isoformat(),
        })

        log.info(f"[{scan_id}] Done — score={score:.1f}, paths={len(paths)}")

    except Exception as e:
        log.exception(f"[{scan_id}] Failed: {e}")
        _scans[scan_id].update({"status": "failed", "error": str(e)})


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
            "id":             nid,
            "name":           d.get("name", nid),
            "type":           d.get("resource_type", "unknown"),
            "internet_facing": d.get("internet_facing", False),
            "is_sensitive":   d.get("is_sensitive", False),
            "is_admin":       d.get("is_admin", False),
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


handler = Mangum(app)