import pytest
from backend.extractor.base import Resource, ResourceType
from backend.graph.builder  import CanopyGraph
from backend.graph.models   import Edge, EdgeType
from backend.engine.attack_paths import (
    AttackPathEngine, AttackPath, AttackHop, INTERNET_NODE, MAX_HOPS, MAX_WEIGHT
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make(rid, rtype, internet=False, sensitive=False, admin=False):
    r = Resource(
        resource_id    = rid,
        resource_type  = rtype,
        name           = rid,
        arn            = f"arn:test:{rid}",
        region         = "us-east-1",
        account_id     = "123456789",
        internet_facing= internet,
        is_sensitive   = sensitive,
    )
    if admin:
        r.metadata["is_admin"] = True
        r.is_sensitive = True
    return r


def add(graph, src, tgt, etype, weight):
    graph.add_edge(Edge(src, tgt, etype, weight, {"description": f"{src} to {tgt}"}))


def simple_chain():
    """INTERNET → EC2 → AppRole → AdminRole  (scores 0.1+0.2+0.15 = 0.45)"""
    g = CanopyGraph("test")
    for r in [
        make(INTERNET_NODE, ResourceType.INTERNET,        internet=True),
        make("ec2-1",       ResourceType.EC2_INSTANCE,    internet=True),
        make("app-role",    ResourceType.IAM_ROLE),
        make("admin-role",  ResourceType.IAM_ROLE,        admin=True),
    ]:
        g.add_resource(r)
    add(g, INTERNET_NODE, "ec2-1",      EdgeType.EXPOSES_PORT,  0.1)
    add(g, "ec2-1",       "app-role",   EdgeType.HAS_ROLE,      0.2)
    add(g, "app-role",    "admin-role", EdgeType.CAN_ASSUME,    0.15)
    return g


# ── Basic path finding ────────────────────────────────────────────────────────

def test_finds_path():
    paths = AttackPathEngine(simple_chain()).find_all()
    assert len(paths) > 0


def test_correct_target():
    paths = AttackPathEngine(simple_chain()).find_all()
    assert paths[0].target_id == "admin-role"


def test_score_is_correct():
    paths = AttackPathEngine(simple_chain()).find_all()
    assert abs(paths[0].score - 0.45) < 0.001


def test_hop_count_is_correct():
    paths = AttackPathEngine(simple_chain()).find_all()
    assert paths[0].hop_count == 3


def test_exploitability_is_critical():
    paths = AttackPathEngine(simple_chain()).find_all()
    assert paths[0].exploitability == "CRITICAL"


def test_hops_have_correct_structure():
    paths = AttackPathEngine(simple_chain()).find_all()
    hop   = paths[0].hops[0]
    assert hop.source_id   == INTERNET_NODE
    assert hop.target_id   == "ec2-1"
    assert hop.edge_type   == EdgeType.EXPOSES_PORT.value
    assert hop.weight      == 0.1
    assert hop.description != ""


def test_paths_sorted_by_score():
    """Two paths to different targets — cheaper one must come first."""
    g = CanopyGraph("test")
    for r in [
        make(INTERNET_NODE, ResourceType.INTERNET,     internet=True),
        make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True),
        make("ec2-2",       ResourceType.EC2_INSTANCE, internet=True),
        make("role-cheap",  ResourceType.IAM_ROLE,     admin=True),
        make("role-expensive", ResourceType.IAM_ROLE,  admin=True),
    ]:
        g.add_resource(r)
    add(g, INTERNET_NODE, "ec2-1",        EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "role-cheap",   EdgeType.HAS_ROLE,     0.2)
    add(g, INTERNET_NODE, "ec2-2",        EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-2",       "role-expensive", EdgeType.HAS_ROLE,   0.8)
    paths = AttackPathEngine(g).find_all()
    assert paths[0].score < paths[1].score


# ── No paths cases ────────────────────────────────────────────────────────────

def test_no_path_when_isolated():
    """Admin role exists but has no edges from INTERNET."""
    g = CanopyGraph("test")
    g.add_resource(make(INTERNET_NODE, ResourceType.INTERNET, internet=True))
    g.add_resource(make("admin-role",  ResourceType.IAM_ROLE, admin=True))
    assert AttackPathEngine(g).find_all() == []


def test_no_path_when_no_internet_node():
    g = CanopyGraph("test")
    g.add_resource(make("ec2-1",      ResourceType.EC2_INSTANCE))
    g.add_resource(make("admin-role", ResourceType.IAM_ROLE, admin=True))
    add(g, "ec2-1", "admin-role", EdgeType.HAS_ROLE, 0.2)
    assert AttackPathEngine(g).find_all() == []


def test_no_path_when_no_targets():
    """Graph has edges but no sensitive or admin nodes."""
    g = CanopyGraph("test")
    g.add_resource(make(INTERNET_NODE, ResourceType.INTERNET,     internet=True))
    g.add_resource(make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True))
    g.add_resource(make("role-1",      ResourceType.IAM_ROLE))
    add(g, INTERNET_NODE, "ec2-1",   EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "role-1",  EdgeType.HAS_ROLE,     0.2)
    assert AttackPathEngine(g).find_all() == []


def test_empty_graph_returns_empty():
    assert AttackPathEngine(CanopyGraph("test")).find_all() == []


# ── Cycle prevention ──────────────────────────────────────────────────────────

def test_circular_trust_does_not_loop():
    """RoleA trusts RoleB, RoleB trusts RoleA — must terminate."""
    g = CanopyGraph("test")
    for r in [
        make(INTERNET_NODE, ResourceType.INTERNET,  internet=True),
        make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True),
        make("role-a",      ResourceType.IAM_ROLE),
        make("role-b",      ResourceType.IAM_ROLE),
        make("admin",       ResourceType.IAM_ROLE,  admin=True),
    ]:
        g.add_resource(r)
    add(g, INTERNET_NODE, "ec2-1",   EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "role-a",  EdgeType.HAS_ROLE,     0.2)
    add(g, "role-a",      "role-b",  EdgeType.CAN_ASSUME,   0.2)
    add(g, "role-b",      "role-a",  EdgeType.CAN_ASSUME,   0.2)   # cycle
    add(g, "role-b",      "admin",   EdgeType.CAN_ASSUME,   0.15)
    paths = AttackPathEngine(g).find_all()
    assert len(paths) > 0
    for path in paths:
        node_ids = [h.source_id for h in path.hops] + [path.target_id]
        assert len(node_ids) == len(set(node_ids)), "Cycle detected in path"


# ── Pruning ───────────────────────────────────────────────────────────────────

def test_max_weight_pruned():
    """Path total weight exceeds MAX_WEIGHT — should not appear."""
    g = CanopyGraph("test")
    g.add_resource(make(INTERNET_NODE, ResourceType.INTERNET,     internet=True))
    g.add_resource(make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True))
    g.add_resource(make("admin",       ResourceType.IAM_ROLE,     admin=True))
    add(g, INTERNET_NODE, "ec2-1",  EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "admin",  EdgeType.HAS_ROLE,     MAX_WEIGHT + 0.1)
    assert AttackPathEngine(g).find_all() == []


def test_max_hops_pruned():
    """Chain longer than MAX_HOPS — should not appear."""
    g = CanopyGraph("test")
    nodes = [INTERNET_NODE] + [f"node-{i}" for i in range(MAX_HOPS + 2)]
    types = [ResourceType.INTERNET] + [ResourceType.IAM_ROLE] * (MAX_HOPS + 2)
    for nid, ntype in zip(nodes, types):
        g.add_resource(make(nid, ntype, internet=(nid == INTERNET_NODE)))
    g.resources[nodes[-1]].is_sensitive = True
    g.G.nodes[nodes[-1]]["is_sensitive"] = True
    for i in range(len(nodes) - 1):
        add(g, nodes[i], nodes[i+1], EdgeType.CAN_ASSUME, 0.1)
    assert AttackPathEngine(g).find_all() == []


# ── Exploitability thresholds ─────────────────────────────────────────────────

def test_exploitability_high():
    g = CanopyGraph("test")
    g.add_resource(make(INTERNET_NODE, ResourceType.INTERNET,     internet=True))
    g.add_resource(make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True))
    g.add_resource(make("admin",       ResourceType.IAM_ROLE,     admin=True))
    add(g, INTERNET_NODE, "ec2-1",  EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "admin",  EdgeType.HAS_ROLE,     0.9)
    paths = AttackPathEngine(g).find_all()
    assert paths[0].exploitability == "HIGH"


def test_exploitability_medium():
    g = CanopyGraph("test")
    g.add_resource(make(INTERNET_NODE, ResourceType.INTERNET,     internet=True))
    g.add_resource(make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True))
    g.add_resource(make("admin",       ResourceType.IAM_ROLE,     admin=True))
    add(g, INTERNET_NODE, "ec2-1",  EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "admin",  EdgeType.HAS_ROLE,     1.6)
    paths = AttackPathEngine(g).find_all()
    assert paths[0].exploitability == "MEDIUM"


def test_exploitability_low():
    g = CanopyGraph("test")
    g.add_resource(make(INTERNET_NODE, ResourceType.INTERNET,     internet=True))
    g.add_resource(make("ec2-1",       ResourceType.EC2_INSTANCE, internet=True))
    g.add_resource(make("admin",       ResourceType.IAM_ROLE,     admin=True))
    add(g, INTERNET_NODE, "ec2-1",  EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "admin",  EdgeType.HAS_ROLE,     2.6)
    paths = AttackPathEngine(g).find_all()
    assert paths[0].exploitability == "LOW"


# ── Deduplication ─────────────────────────────────────────────────────────────

def test_deduplication_same_pattern():
    """Two paths to same target via same edge type sequence — keep only cheaper."""
    g = CanopyGraph("test")
    for r in [
        make(INTERNET_NODE, ResourceType.INTERNET,     internet=True),
        make("ec2-a",       ResourceType.EC2_INSTANCE, internet=True),
        make("ec2-b",       ResourceType.EC2_INSTANCE, internet=True),
        make("admin",       ResourceType.IAM_ROLE,     admin=True),
    ]:
        g.add_resource(r)
    add(g, INTERNET_NODE, "ec2-a",  EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-a",       "admin",  EdgeType.HAS_ROLE,     0.2)
    add(g, INTERNET_NODE, "ec2-b",  EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-b",       "admin",  EdgeType.HAS_ROLE,     0.5)
    paths = AttackPathEngine(g).find_all()
    sigs  = [p.target_id + "::" + ":".join(h.edge_type for h in p.hops) for p in paths]
    assert len(sigs) == len(set(sigs)), "Duplicate signature found after deduplication"


# ── to_dict serialisation ─────────────────────────────────────────────────────

def test_to_dict_structure():
    paths = AttackPathEngine(simple_chain()).find_all()
    d     = paths[0].to_dict()
    for key in ["score", "exploitability", "hop_count", "target_name",
                "target_type", "blast_radius", "ai_narrative", "hops"]:
        assert key in d, f"Missing key: {key}"
    assert isinstance(d["hops"], list)
    assert len(d["hops"]) == paths[0].hop_count


def test_to_dict_hop_keys():
    paths = AttackPathEngine(simple_chain()).find_all()
    hop   = paths[0].to_dict()["hops"][0]
    for key in ["source_name", "target_name", "edge_type", "weight", "description"]:
        assert key in hop, f"Missing hop key: {key}"


# ── Multiple paths to same target ─────────────────────────────────────────────

def test_multiple_paths_to_same_target():
    """Two distinct routes to admin — both should appear (different edge sequences)."""
    g = CanopyGraph("test")
    for r in [
        make(INTERNET_NODE, ResourceType.INTERNET,      internet=True),
        make("ec2-1",       ResourceType.EC2_INSTANCE,  internet=True),
        make("lambda-1",    ResourceType.LAMBDA_FUNCTION, internet=True),
        make("role-a",      ResourceType.IAM_ROLE),
        make("admin",       ResourceType.IAM_ROLE,      admin=True),
    ]:
        g.add_resource(r)
    add(g, INTERNET_NODE, "ec2-1",    EdgeType.EXPOSES_PORT, 0.1)
    add(g, "ec2-1",       "role-a",   EdgeType.HAS_ROLE,     0.2)
    add(g, "role-a",      "admin",    EdgeType.CAN_ASSUME,   0.15)
    add(g, INTERNET_NODE, "lambda-1", EdgeType.EXPOSES_PORT, 0.1)
    add(g, "lambda-1",    "admin",    EdgeType.HAS_ROLE,     0.2)
    paths = AttackPathEngine(g).find_all()
    assert len(paths) >= 2