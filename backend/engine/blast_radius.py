from dataclasses import dataclass
import networkx as nx
from ..graph.builder import CanopyGraph

DAMAGE = {
    "iam:role":          10.0,
    "rds:instance":       8.0,
    "iam:user":           7.0,
    "s3:bucket":          6.0,
    "lambda:function":    5.0,
    "ec2:instance":       4.0,
    "ec2:security_group": 2.0,
}


@dataclass
class BlastRadius:
    compromised_id:         str
    score:                  float
    reachable_count:        int
    sensitive_count:        int
    can_delete_account:     bool
    estimated_recovery_hrs: float
    reachable_by_type:      dict


class BlastRadiusCalculator:

    def __init__(self, graph: CanopyGraph):
        self.graph = graph
        self.G     = graph.G

    def calculate(self, node_id: str) -> BlastRadius:
        try:
            reachable = nx.descendants(self.G, node_id)
        except Exception:
            reachable = set()

        total, sensitive, admin = 0.0, 0, False
        by_type: dict = {}

        for rid in reachable:
            data  = self.G.nodes.get(rid, {})
            rtype = data.get("resource_type", "unknown")
            if rtype == "pseudo:internet":
                continue

            total    += DAMAGE.get(rtype, 1.0)
            by_type[rtype] = by_type.get(rtype, 0) + 1

            if data.get("is_sensitive"): sensitive += 1
            if data.get("is_admin"):     admin = True

        node_count   = max(self.G.number_of_nodes() - 1, 1)
        max_possible = node_count * max(DAMAGE.values())
        score        = min(100.0, (total / max_possible) * 100) if max_possible else 0

        if admin:
            recovery = 168.0
        else:
            recovery = (
                by_type.get("rds:instance", 0) * 8 +
                by_type.get("s3:bucket", 0)     * 4 +
                by_type.get("ec2:instance", 0)  * 2 +
                by_type.get("lambda:function", 0) * 1
            )

        return BlastRadius(
            compromised_id         = node_id,
            score                  = round(score, 1),
            reachable_count        = len(reachable),
            sensitive_count        = sensitive,
            can_delete_account     = admin,
            estimated_recovery_hrs = recovery,
            reachable_by_type      = by_type,
        )