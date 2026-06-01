import pytest
from backend.extractor.base import Resource, ResourceType
from backend.graph.builder  import (
    build_graph, CanopyGraph, INTERNET_ID,_add_network_edges,_add_iam_edges, _add_privilege_escalation_edges
)
import backend.graph.builder as _builder
from backend.graph.models import EdgeType


def make(rid, rtype, internet=False, sensitive=False, admin=False, **meta):
    r = Resource(
        resource_id    = rid,
        resource_type  = rtype,
        name           = rid,
        arn            = f"arn:test:{rid}",
        region         = "us-east-1",
        account_id     = "123",
        internet_facing= internet,
        is_sensitive   = sensitive,
    )
    r.metadata.update(meta)
    if admin:
        r.metadata["is_admin"] = True
        r.is_sensitive = True
    return r


# ── CanopyGraph basics ────────────────────────────────────────────────────────

def test_add_resource_creates_node():
    g = CanopyGraph("test")
    r = make("ec2-1", ResourceType.EC2_INSTANCE)
    g.add_resource(r)
    assert "ec2-1" in g.G.nodes


def test_node_attributes_stored():
    g = CanopyGraph("test")
    r = make("ec2-1", ResourceType.EC2_INSTANCE, internet=True)
    g.add_resource(r)
    data = g.G.nodes["ec2-1"]
    assert data["internet_facing"] is True
    assert data["resource_type"]   == "ec2:instance"


def test_add_edge_creates_edge():
    from backend.graph.models import Edge
    g = CanopyGraph("test")
    g.add_resource(make("a", ResourceType.EC2_INSTANCE))
    g.add_resource(make("b", ResourceType.IAM_ROLE))
    from backend.graph.models import Edge, EdgeType
    g.add_edge(Edge("a", "b", EdgeType.HAS_ROLE, 0.2, {"description": "test"}))
    assert g.G.has_edge("a", "b")


def test_add_edge_missing_node_skipped():
    from backend.graph.models import Edge, EdgeType
    g = CanopyGraph("test")
    g.add_resource(make("a", ResourceType.EC2_INSTANCE))
    g.add_edge(Edge("a", "nonexistent", EdgeType.HAS_ROLE, 0.2))
    assert not g.G.has_edge("a", "nonexistent")


def test_edge_weight_stored():
    from backend.graph.models import Edge, EdgeType
    g = CanopyGraph("test")
    g.add_resource(make("a", ResourceType.EC2_INSTANCE))
    g.add_resource(make("b", ResourceType.IAM_ROLE))
    g.add_edge(Edge("a", "b", EdgeType.HAS_ROLE, 0.2))
    assert g.G.edges["a", "b"]["weight"] == 0.2


# ── build_graph ───────────────────────────────────────────────────────────────

def test_build_graph_adds_internet_node():
    g = build_graph("test", [])
    assert INTERNET_ID in g.G.nodes


def test_build_graph_returns_canopy_graph():
    g = build_graph("test", [])
    assert isinstance(g, CanopyGraph)


def test_build_graph_adds_all_resources():
    resources = [
        make("ec2-1", ResourceType.EC2_INSTANCE),
        make("s3-1",  ResourceType.S3_BUCKET),
        make("role-1",ResourceType.IAM_ROLE),
    ]
    g = build_graph("test", resources)
    assert "ec2-1"  in g.G.nodes
    assert "s3-1"   in g.G.nodes
    assert "role-1" in g.G.nodes


# ── Network edges ─────────────────────────────────────────────────────────────

def test_internet_facing_gets_network_edge():
    g = CanopyGraph("test")
    r = make("ec2-pub", ResourceType.EC2_INSTANCE, internet=True)
    g.add_resource(r)
    g.add_resource(make(INTERNET_ID, ResourceType.INTERNET, internet=True))
    _add_network_edges(g, [r])
    assert g.G.has_edge(INTERNET_ID, "ec2-pub")


def test_non_internet_facing_no_network_edge():
    g = CanopyGraph("test")
    r = make("ec2-priv", ResourceType.EC2_INSTANCE, internet=False)
    g.add_resource(r)
    g.add_resource(make(INTERNET_ID, ResourceType.INTERNET, internet=True))
    _add_network_edges(g, [r])
    assert not g.G.has_edge(INTERNET_ID, "ec2-priv")


def test_network_edge_weight_is_01():
    g = CanopyGraph("test")
    r = make("ec2-pub", ResourceType.EC2_INSTANCE, internet=True)
    g.add_resource(r)
    g.add_resource(make(INTERNET_ID, ResourceType.INTERNET, internet=True))
    _add_network_edges(g, [r])
    assert g.G.edges[INTERNET_ID, "ec2-pub"]["weight"] == 0.1


# ── IAM structural edges ──────────────────────────────────────────────────────

def test_ec2_to_role_edge_created():
    role = make("AppRole", ResourceType.IAM_ROLE)
    ec2  = make("ec2-1",   ResourceType.EC2_INSTANCE,
                iam_role_name="AppRole")
    g = CanopyGraph("test")
    for r in [role, ec2]:
        g.add_resource(r)
    _add_iam_edges(g, [role, ec2])
    assert g.G.has_edge("ec2-1", "AppRole")
    assert g.G.edges["ec2-1", "AppRole"]["edge_type"] == EdgeType.HAS_ROLE.value


def test_ec2_no_role_no_edge():
    ec2 = make("ec2-1", ResourceType.EC2_INSTANCE)
    g   = CanopyGraph("test")
    g.add_resource(ec2)
    _add_iam_edges(g, [ec2])
    assert g.G.number_of_edges() == 0


def test_ec2_role_name_not_in_graph_no_edge():
    ec2 = make("ec2-1", ResourceType.EC2_INSTANCE, iam_role_name="MissingRole")
    g   = CanopyGraph("test")
    g.add_resource(ec2)
    _add_iam_edges(g, [ec2])
    assert g.G.number_of_edges() == 0


def test_lambda_to_role_edge_created():
    role = make("LambdaExecRole", ResourceType.IAM_ROLE)
    fn   = make("my-fn", ResourceType.LAMBDA_FUNCTION, role_name="LambdaExecRole")
    g    = CanopyGraph("test")
    for r in [role, fn]:
        g.add_resource(r)
    _add_iam_edges(g, [role, fn])
    assert g.G.has_edge("my-fn", "LambdaExecRole")


def test_role_trust_policy_edge_created():
    role_a = make("RoleA", ResourceType.IAM_ROLE,
                  trust_principals=["arn:aws:iam::123:role/RoleB"])
    role_b = make("RoleB", ResourceType.IAM_ROLE,
                  arn="arn:aws:iam::123:role/RoleB")
    role_b.arn = "arn:aws:iam::123:role/RoleB"

    g = CanopyGraph("test")
    for r in [role_a, role_b]:
        g.add_resource(r)
    _add_iam_edges(g, [role_a, role_b])
    assert g.G.has_edge("RoleB", "RoleA")
    assert g.G.edges["RoleB", "RoleA"]["edge_type"] == EdgeType.CAN_ASSUME.value


def test_wildcard_principal_creates_internet_edge():
    role = make("PublicRole", ResourceType.IAM_ROLE,
                trust_principals=["*"])
    internet = make(INTERNET_ID, ResourceType.INTERNET, internet=True)
    g = CanopyGraph("test")
    g.add_resource(role)
    g.add_resource(internet)
    _add_iam_edges(g, [role])
    assert g.G.has_edge(INTERNET_ID, "PublicRole")
    assert g.G.edges[INTERNET_ID, "PublicRole"]["weight"] == 0.05


# ── Privilege escalation edges ────────────────────────────────────────────────

def test_priv_esc_edge_for_attach_role_policy():
    admin = make("AdminRole", ResourceType.IAM_ROLE, admin=True)
    role  = make("DevRole",   ResourceType.IAM_ROLE,
                 inline_policy_docs={"EscPolicy": {
                     "Statement": [{
                         "Effect":   "Allow",
                         "Action":   "iam:AttachRolePolicy",
                         "Resource": "*",
                     }]
                 }})
    g = CanopyGraph("test")
    g.add_resource(admin)
    g.add_resource(role)
    _add_privilege_escalation_edges(g, [admin, role])
    assert g.G.has_edge("DevRole", "AdminRole")
    assert g.G.edges["DevRole", "AdminRole"]["weight"] == 0.15


def test_priv_esc_edge_for_wildcard_iam():
    admin = make("AdminRole", ResourceType.IAM_ROLE, admin=True)
    role  = make("DevRole",   ResourceType.IAM_ROLE,
                 inline_policy_docs={"EscPolicy": {
                     "Statement": [{
                         "Effect": "Allow", "Action": "iam:*", "Resource": "*"
                     }]
                 }})
    g = CanopyGraph("test")
    g.add_resource(admin)
    g.add_resource(role)
    _add_privilege_escalation_edges(g, [admin, role])
    assert g.G.has_edge("DevRole", "AdminRole")


def test_no_priv_esc_without_dangerous_action():
    admin = make("AdminRole", ResourceType.IAM_ROLE, admin=True)
    role  = make("DevRole",   ResourceType.IAM_ROLE,
                 inline_policy_docs={"SafePolicy": {
                     "Statement": [{
                         "Effect": "Allow", "Action": "s3:GetObject", "Resource": "*"
                     }]
                 }})
    g = CanopyGraph("test")
    g.add_resource(admin)
    g.add_resource(role)
    _add_privilege_escalation_edges(g, [admin, role])
    assert not g.G.has_edge("DevRole", "AdminRole")


def test_admin_role_not_given_priv_esc_edge():
    """Admin role should not get a privilege escalation edge to itself."""
    admin = make("AdminRole", ResourceType.IAM_ROLE, admin=True,
                 inline_policy_docs={"AllPolicy": {
                     "Statement": [{"Effect":"Allow","Action":"*","Resource":"*"}]
                 }})
    g = CanopyGraph("test")
    g.add_resource(admin)
    _add_privilege_escalation_edges(g, [admin])
    assert not g.G.has_edge("AdminRole", "AdminRole")


def test_priv_esc_deny_statement_ignored():
    """Deny statement should not create privilege escalation edge."""
    admin = make("AdminRole", ResourceType.IAM_ROLE, admin=True)
    role  = make("DevRole",   ResourceType.IAM_ROLE,
                 inline_policy_docs={"DenyEsc": {
                     "Statement": [{
                         "Effect": "Deny", "Action": "iam:AttachRolePolicy", "Resource": "*"
                     }]
                 }})
    g = CanopyGraph("test")
    g.add_resource(admin)
    g.add_resource(role)
    _add_privilege_escalation_edges(g, [admin, role])
    assert not g.G.has_edge("DevRole", "AdminRole")