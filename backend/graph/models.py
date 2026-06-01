# backend/graph/models.py
from dataclasses import dataclass, field
from enum import Enum


class EdgeType(Enum):
    EXPOSES_PORT = "EXPOSES_PORT"
    ATTACHED_SG = "ATTACHED_SG"
    HAS_ROLE = "HAS_ROLE"
    CAN_ASSUME = "CAN_ASSUME"
    CAN_ACCESS = "CAN_ACCESS"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    HAS_ENV_CREDS = "HAS_ENV_CREDS"


EDGE_WEIGHTS = {
    EdgeType.EXPOSES_PORT: 0.1,   # Open port: trivial
    EdgeType.ATTACHED_SG: 0.0,    # Logical link
    EdgeType.HAS_ROLE: 0.2,       # Instance profile assumption
    EdgeType.CAN_ASSUME: 0.2,     # IAM trust policy
    EdgeType.CAN_ACCESS: 0.3,
    EdgeType.PRIVILEGE_ESCALATION : 0.15,    # Permission-based access
    EdgeType.HAS_ENV_CREDS: 0.1,  # Credential in env var
}


@dataclass
class Edge:
    source_id: str
    target_id: str
    edge_type: EdgeType
    weight: float = 0.5
    properties: dict = field(default_factory=dict)