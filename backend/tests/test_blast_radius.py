import pytest
from backend.extractor.base import Resource, ResourceType
from backend.graph.builder  import CanopyGraph
from backend.graph.models   import Edge, EdgeType
from backend.engine.blast_radius import BlastRadiusCalculator, DAMAGE


# ── Helpers ───────────────────────────────────────────────────────────────────

def make(rid, rtype, admin=False, sensitive=False):
    r = Resource(
        resource_id   = rid,
        resource_type = rtype,
        name          = rid,
        arn           = f"arn:test:{rid}",
        region        = "us-east-1",
        account_id    = "123456789",
        is_sensitive  = sensitive,
    )
    if admin:
        r.metadata["is_admin"] = True
        r.is_sensitive = True
    return r


def add(graph, src, tgt, etype=EdgeType.CAN_ACCESS, weight=0.3):
    graph.add_edge(Edge(src, tgt, etype, weight, {"description": f"{src} to {tgt}"}))


# ── Score range ───────────────────────────────────────────────────────────────

def test_score_between_0_and_100():
    g = CanopyGraph("test")
    g.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    g.add_resource(make("s3",    ResourceType.S3_BUCKET))
    add(g, "admin", "s3")
    br = BlastRadiusCalculator(g).calculate("admin")
    assert 0.0 <= br.score <= 100.0


def test_isolated_node_score_is_zero():
    g = CanopyGraph("test")
    g.add_resource(make("lonely", ResourceType.IAM_ROLE, admin=True))
    br = BlastRadiusCalculator(g).calculate("lonely")
    assert br.score == 0.0
    assert br.reachable_count == 0


def test_score_increases_with_more_reachable():
    g1 = CanopyGraph("test1")
    g1.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    g1.add_resource(make("s3-1",  ResourceType.S3_BUCKET))
    add(g1, "admin", "s3-1")
    br1 = BlastRadiusCalculator(g1).calculate("admin")

    g2 = CanopyGraph("test2")
    g2.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    for i in range(5):
        g2.add_resource(make(f"s3-{i}", ResourceType.S3_BUCKET))
        add(g2, "admin", f"s3-{i}")
    br2 = BlastRadiusCalculator(g2).calculate("admin")

    assert br2.score > br1.score


# ── Admin detection ───────────────────────────────────────────────────────────

def test_admin_reachable_sets_can_delete_account():
    g = CanopyGraph("test")
    g.add_resource(make("role-a", ResourceType.IAM_ROLE))
    g.add_resource(make("admin",  ResourceType.IAM_ROLE, admin=True))
    add(g, "role-a", "admin", EdgeType.CAN_ASSUME)
    br = BlastRadiusCalculator(g).calculate("role-a")
    assert br.can_delete_account is True


def test_no_admin_reachable_is_false():
    g = CanopyGraph("test")
    g.add_resource(make("role-a", ResourceType.IAM_ROLE))
    g.add_resource(make("s3-1",   ResourceType.S3_BUCKET))
    add(g, "role-a", "s3-1")
    br = BlastRadiusCalculator(g).calculate("role-a")
    assert br.can_delete_account is False


# ── Reachable count ───────────────────────────────────────────────────────────

def test_reachable_count_direct():
    g = CanopyGraph("test")
    g.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    for i in range(3):
        g.add_resource(make(f"s3-{i}", ResourceType.S3_BUCKET))
        add(g, "admin", f"s3-{i}")
    br = BlastRadiusCalculator(g).calculate("admin")
    assert br.reachable_count == 3


def test_reachable_count_transitive():
    """admin → role-b → s3 — all three reachable from admin."""
    g = CanopyGraph("test")
    g.add_resource(make("admin",  ResourceType.IAM_ROLE, admin=True))
    g.add_resource(make("role-b", ResourceType.IAM_ROLE))
    g.add_resource(make("s3-1",   ResourceType.S3_BUCKET))
    add(g, "admin",  "role-b", EdgeType.CAN_ASSUME)
    add(g, "role-b", "s3-1",   EdgeType.CAN_ACCESS)
    br = BlastRadiusCalculator(g).calculate("admin")
    assert br.reachable_count == 2


# ── Sensitive count ───────────────────────────────────────────────────────────

def test_sensitive_count_correct():
    g = CanopyGraph("test")
    g.add_resource(make("admin",   ResourceType.IAM_ROLE, admin=True))
    g.add_resource(make("s3-sens", ResourceType.S3_BUCKET, sensitive=True))
    g.add_resource(make("s3-norm", ResourceType.S3_BUCKET))
    add(g, "admin", "s3-sens")
    add(g, "admin", "s3-norm")
    br = BlastRadiusCalculator(g).calculate("admin")
    assert br.sensitive_count == 1


# ── Recovery time ─────────────────────────────────────────────────────────────

def test_recovery_hours_admin_is_168():
    g = CanopyGraph("test")
    g.add_resource(make("role-a", ResourceType.IAM_ROLE))
    g.add_resource(make("admin",  ResourceType.IAM_ROLE, admin=True))
    add(g, "role-a", "admin", EdgeType.CAN_ASSUME)
    br = BlastRadiusCalculator(g).calculate("role-a")
    assert br.estimated_recovery_hrs == 168.0


def test_recovery_hours_no_admin_uses_resource_weights():
    g = CanopyGraph("test")
    g.add_resource(make("role-a", ResourceType.IAM_ROLE))
    g.add_resource(make("s3-1",   ResourceType.S3_BUCKET))
    g.add_resource(make("s3-2",   ResourceType.S3_BUCKET))
    add(g, "role-a", "s3-1")
    add(g, "role-a", "s3-2")
    br = BlastRadiusCalculator(g).calculate("role-a")
    assert br.estimated_recovery_hrs == 8.0   # 2 buckets × 4 hrs each


def test_recovery_hours_zero_when_isolated():
    g = CanopyGraph("test")
    g.add_resource(make("lonely", ResourceType.IAM_ROLE))
    br = BlastRadiusCalculator(g).calculate("lonely")
    assert br.estimated_recovery_hrs == 0.0


# ── Reachable by type ─────────────────────────────────────────────────────────

def test_reachable_by_type_populated():
    g = CanopyGraph("test")
    g.add_resource(make("admin",   ResourceType.IAM_ROLE, admin=True))
    g.add_resource(make("s3-1",    ResourceType.S3_BUCKET))
    g.add_resource(make("lambda-1",ResourceType.LAMBDA_FUNCTION))
    add(g, "admin", "s3-1")
    add(g, "admin", "lambda-1")
    br = BlastRadiusCalculator(g).calculate("admin")
    assert br.reachable_by_type.get("s3:bucket",       0) == 1
    assert br.reachable_by_type.get("lambda:function", 0) == 1


# ── Damage weights ────────────────────────────────────────────────────────────

def test_iam_role_scores_higher_than_s3():
    """IAM role has higher damage weight than S3 bucket."""
    g_iam = CanopyGraph("test1")
    g_iam.add_resource(make("src",   ResourceType.IAM_ROLE))
    g_iam.add_resource(make("tgt",   ResourceType.IAM_ROLE))
    add(g_iam, "src", "tgt", EdgeType.CAN_ASSUME)
    br_iam = BlastRadiusCalculator(g_iam).calculate("src")

    g_s3 = CanopyGraph("test2")
    g_s3.add_resource(make("src", ResourceType.IAM_ROLE))
    g_s3.add_resource(make("tgt", ResourceType.S3_BUCKET))
    add(g_s3, "src", "tgt")
    br_s3 = BlastRadiusCalculator(g_s3).calculate("src")

    assert br_iam.score > br_s3.score


def test_unknown_resource_type_uses_default_damage():
    """Resources not in DAMAGE dict still contribute a non-zero score."""
    g = CanopyGraph("test")
    g.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    g.add_resource(make("sg-1",  ResourceType.EC2_SG))
    add(g, "admin", "sg-1")
    br = BlastRadiusCalculator(g).calculate("admin")
    assert br.score > 0.0


# ── Internet node excluded ────────────────────────────────────────────────────

def test_internet_node_not_counted_in_blast():
    """pseudo:internet node should not contribute to blast radius damage."""
    from backend.engine.attack_paths import INTERNET_NODE
    g = CanopyGraph("test")
    g.add_resource(Resource(
        resource_id="INTERNET", resource_type=ResourceType.INTERNET,
        name="Internet", arn="pseudo:internet", region="global",
        account_id="N/A", internet_facing=True,
    ))
    g.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    add(g, INTERNET_NODE, "admin", EdgeType.CAN_ASSUME)
    br_with_internet = BlastRadiusCalculator(g).calculate("admin")

    g2 = CanopyGraph("test2")
    g2.add_resource(make("admin", ResourceType.IAM_ROLE, admin=True))
    br_without = BlastRadiusCalculator(g2).calculate("admin")

    assert br_with_internet.score == br_without.score