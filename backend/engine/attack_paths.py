import heapq
import logging
from dataclasses import dataclass, field
from typing import Optional

from ..graph.builder import CanopyGraph

log           = logging.getLogger(__name__)
INTERNET_NODE = "INTERNET"
MAX_HOPS      = 6
MAX_WEIGHT    = 4.0
MAX_PATHS     = 30


@dataclass
class AttackHop:
    source_id:   str
    source_name: str
    target_id:   str
    target_name: str
    edge_type:   str
    weight:      float
    description: str = ""


@dataclass(order=True)
class AttackPath:
    score:        float
    hops:         list  = field(compare=False, default_factory=list)
    target_id:    str   = field(compare=False, default="")
    target_name:  str   = field(compare=False, default="")
    target_type:  str   = field(compare=False, default="")
    blast_radius: float = field(compare=False, default=0.0)
    ai_narrative: str   = field(compare=False, default="")

    @property
    def exploitability(self) -> str:
        if self.score < 0.8:  return "CRITICAL"
        if self.score < 1.5:  return "HIGH"
        if self.score < 2.5:  return "MEDIUM"
        return "LOW"

    @property
    def hop_count(self) -> int:
        return len(self.hops)

    def to_dict(self) -> dict:
        return {
            "score":          round(self.score, 4),
            "exploitability": self.exploitability,
            "hop_count":      self.hop_count,
            "target_name":    self.target_name,
            "target_type":    self.target_type,
            "blast_radius":   self.blast_radius,
            "ai_narrative":   self.ai_narrative,
            "hops": [{
                "source_name": h.source_name,
                "target_name": h.target_name,
                "edge_type":   h.edge_type,
                "weight":      h.weight,
                "description": h.description,
                "source_id":   h.source_id,
                "target_id":   h.target_id,
            } for h in self.hops],
        }


class AttackPathEngine:

    def __init__(self, graph: CanopyGraph):
        self.graph = graph
        self.G     = graph.G

    def find_all(self) -> list:
        if INTERNET_NODE not in self.G:
            log.warning("No INTERNET node — cannot find paths")
            return []

        targets = self._get_targets()
        if not targets:
            log.info("No targets found")
            return []

        log.info(f"Searching paths to {len(targets)} targets")

        all_paths = []
        for tid in targets:
            found = self._find_to(tid)
            all_paths.extend(found)
            log.info(f"  {tid}: {len(found)} paths")

        all_paths.sort(key=lambda p: p.score)
        all_paths = self._deduplicate(all_paths)

        log.info(f"Total: {len(all_paths)} attack paths")
        return all_paths[:MAX_PATHS]

    def _get_targets(self) -> list:
        targets = []
        for nid, data in self.G.nodes(data=True):
            if nid == INTERNET_NODE:
                continue
            if data.get("is_sensitive") or data.get("is_admin"):
                targets.append(nid)
        return targets

    def _find_to(self, target_id: str) -> list:
        paths = []
        heap  = [(0.0, INTERNET_NODE, [INTERNET_NODE],
                  frozenset({INTERNET_NODE}))]

        while heap and len(paths) < 10:
            cost, current, path, visited = heapq.heappop(heap)

            if cost > MAX_WEIGHT:
                continue
            if len(path) > MAX_HOPS + 1:
                continue

            if current == target_id and len(path) > 1:
                ap = self._build(path, cost)
                if ap:
                    paths.append(ap)
                continue

            for nbr in self.G.successors(current):
                if nbr in visited:
                    continue
                edge_data   = self.G.edges[current, nbr]
                edge_weight = edge_data.get("weight", 0.5)
                heapq.heappush(heap, (
                    cost + edge_weight,
                    nbr,
                    path + [nbr],
                    visited | {nbr},
                ))

        return paths

    def _build(self, node_ids: list,
               total_cost: float) -> Optional[AttackPath]:
        if len(node_ids) < 2:
            return None

        hops = []
        for i in range(len(node_ids) - 1):
            s  = node_ids[i]
            t  = node_ids[i + 1]
            sd = self.G.nodes.get(s, {})
            td = self.G.nodes.get(t, {})
            ed = self.G.edges.get((s, t), {})

            hops.append(AttackHop(
                source_id   = s,
                source_name = sd.get("name", s),
                target_id   = t,
                target_name = td.get("name", t),
                edge_type   = ed.get("edge_type", "UNKNOWN"),
                weight      = ed.get("weight", 0.5),
                description = ed.get("description", f"{s} → {t}"),
            ))

        final    = node_ids[-1]
        fdata    = self.G.nodes.get(final, {})

        return AttackPath(
            score       = round(total_cost, 4),
            hops        = hops,
            target_id   = final,
            target_name = fdata.get("name", final),
            target_type = fdata.get("resource_type", ""),
        )

    def _deduplicate(self, paths: list) -> list:
        seen   = {}
        result = []

        for path in paths:
            sig = path.target_id + "::" + ":".join(h.edge_type for h in path.hops)
            if sig not in seen or seen[sig] > path.score:
                seen[sig] = path.score
                result     = [p for p in result
                              if not (p.target_id + "::" +
                                      ":".join(h.edge_type for h in p.hops) == sig)]
                result.append(path)

        return result