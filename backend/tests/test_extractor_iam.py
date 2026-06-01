import pytest
import json
from urllib.parse import quote
from unittest.mock import MagicMock, patch, call
from backend.extractor.iam import IAMExtractor
from backend.extractor.base import ResourceType


TRUST_POLICY = {
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"AWS": "arn:aws:iam::123456789012:role/OtherRole"},
        "Action": "sts:AssumeRole",
    }]
}

ADMIN_POLICY_DOC = {
    "Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*"}]
}

READONLY_POLICY_DOC = {
    "Statement": [{"Effect": "Allow", "Action": ["Get*", "List*"], "Resource": "*"}]
}


def make_iam_client(roles=None, users=None):
    iam = MagicMock()

    roles = roles or [{
        "RoleId":   "AROABC123",
        "RoleName": "AppRole",
        "Arn":      "arn:aws:iam::123456789012:role/AppRole",
        "AssumeRolePolicyDocument": TRUST_POLICY,
    }]
    users = users or []

    def paginate_side_effect(method, **kwargs):
        pag = MagicMock()
        if method == "list_roles":
            pag.paginate.return_value = iter([{"Roles": roles}])
        elif method == "list_users":
            pag.paginate.return_value = iter([{"Users": users}])
        elif method == "list_attached_role_policies":
            pag.paginate.return_value = iter([{"AttachedPolicies": []}])
        elif method == "list_role_policies":
            pag.paginate.return_value = iter([{"PolicyNames": []}])
        elif method == "list_attached_user_policies":
            pag.paginate.return_value = iter([{"AttachedPolicies": []}])
        elif method == "list_access_keys":
            pag.paginate.return_value = iter([{"AccessKeyMetadata": []}])
        elif method == "list_mfa_devices":
            pag.paginate.return_value = iter([{"MFADevices": []}])
        else:
            pag.paginate.return_value = iter([{}])
        return pag

    iam.get_paginator.side_effect = paginate_side_effect
    return iam


def make_session(iam_client=None):
    session = MagicMock()
    sts = MagicMock()
    sts.get_caller_identity.return_value = {"Account": "123456789012"}

    def client_factory(service, **kwargs):
        if service == "sts":
            return sts
        if service == "iam":
            return iam_client or make_iam_client()
        return MagicMock()

    session.client.side_effect = client_factory
    return session


# ── Basic extraction ──────────────────────────────────────────────────────────

def test_extracts_one_role():
    ext = IAMExtractor(make_session())
    resources = ext.extract()
    roles = [r for r in resources if r.resource_type == ResourceType.IAM_ROLE]
    assert len(roles) == 1
    assert roles[0].name == "AppRole"


def test_role_arn_correct():
    ext = IAMExtractor(make_session())
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert roles[0].arn == "arn:aws:iam::123456789012:role/AppRole"


def test_role_region_is_global():
    ext = IAMExtractor(make_session())
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert roles[0].region == "global"


# ── Trust policy parsing ──────────────────────────────────────────────────────

def test_trust_principals_extracted():
    ext = IAMExtractor(make_session())
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    principals = roles[0].metadata["trust_principals"]
    assert "arn:aws:iam::123456789012:role/OtherRole" in principals


def test_trust_principal_wildcard():
    trust = {
        "Statement": [{
            "Effect":    "Allow",
            "Principal": "*",
            "Action":    "sts:AssumeRole",
        }]
    }
    iam_client = make_iam_client(roles=[{
        "RoleId":   "AROABC",
        "RoleName": "WildRole",
        "Arn":      "arn:aws:iam::123:role/WildRole",
        "AssumeRolePolicyDocument": trust,
    }])
    ext    = IAMExtractor(make_session(iam_client))
    roles  = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert "*" in roles[0].metadata["trust_principals"]


def test_trust_principal_list():
    trust = {
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"AWS": [
                "arn:aws:iam::123:role/RoleA",
                "arn:aws:iam::123:role/RoleB",
            ]},
            "Action": "sts:AssumeRole",
        }]
    }
    iam_client = make_iam_client(roles=[{
        "RoleId": "AROABC", "RoleName": "MultiRole",
        "Arn":    "arn:aws:iam::123:role/MultiRole",
        "AssumeRolePolicyDocument": trust,
    }])
    ext   = IAMExtractor(make_session(iam_client))
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    principals = roles[0].metadata["trust_principals"]
    assert "arn:aws:iam::123:role/RoleA" in principals
    assert "arn:aws:iam::123:role/RoleB" in principals


def test_url_encoded_trust_policy_decoded():
    encoded_trust = quote(json.dumps(TRUST_POLICY))
    iam_client    = make_iam_client(roles=[{
        "RoleId":   "AROABC",
        "RoleName": "EncodedRole",
        "Arn":      "arn:aws:iam::123:role/EncodedRole",
        "AssumeRolePolicyDocument": encoded_trust,
    }])
    ext   = IAMExtractor(make_session(iam_client))
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert isinstance(roles[0].metadata["trust_policy"], dict)


# ── Admin detection ───────────────────────────────────────────────────────────

def test_admin_detected_via_attached_policy():
    iam = make_iam_client()

    def paginate_side_effect(method, **kwargs):
        pag = MagicMock()
        if method == "list_roles":
            pag.paginate.return_value = iter([{"Roles": [{
                "RoleId":   "AROABC",
                "RoleName": "AdminRole",
                "Arn":      "arn:aws:iam::123:role/AdminRole",
                "AssumeRolePolicyDocument": TRUST_POLICY,
            }]}])
        elif method == "list_attached_role_policies":
            pag.paginate.return_value = iter([{"AttachedPolicies": [{
                "PolicyName": "AdministratorAccess",
                "PolicyArn":  "arn:aws:iam::aws:policy/AdministratorAccess",
            }]}])
        elif method in ("list_role_policies", "list_users"):
            pag.paginate.return_value = iter([{
                "PolicyNames": [], "Users": [],
            }])
        else:
            pag.paginate.return_value = iter([{}])
        return pag

    iam.get_paginator.side_effect = paginate_side_effect
    ext   = IAMExtractor(make_session(iam))
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert roles[0].metadata["is_admin"] is True
    assert roles[0].is_sensitive is True


def test_admin_detected_via_inline_policy():
    iam = MagicMock()

    def paginate_side_effect(method, **kwargs):
        pag = MagicMock()
        if method == "list_roles":
            pag.paginate.return_value = iter([{"Roles": [{
                "RoleId":   "AROABC",
                "RoleName": "InlineAdminRole",
                "Arn":      "arn:aws:iam::123:role/InlineAdminRole",
                "AssumeRolePolicyDocument": TRUST_POLICY,
            }]}])
        elif method == "list_attached_role_policies":
            pag.paginate.return_value = iter([{"AttachedPolicies": []}])
        elif method == "list_role_policies":
            pag.paginate.return_value = iter([{"PolicyNames": ["AllowAll"]}])
        elif method in ("list_users", "list_access_keys", "list_mfa_devices"):
            pag.paginate.return_value = iter([{"Users":[], "AccessKeyMetadata":[], "MFADevices":[]}])
        else:
            pag.paginate.return_value = iter([{}])
        return pag

    iam.get_paginator.side_effect = paginate_side_effect
    iam.get_role_policy.return_value = {"PolicyDocument": ADMIN_POLICY_DOC}

    ext   = IAMExtractor(make_session(iam))
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert roles[0].metadata["is_admin"] is True


def test_non_admin_role_not_flagged():
    ext   = IAMExtractor(make_session())
    roles = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_ROLE]
    assert roles[0].metadata["is_admin"] is False


# ── User extraction ───────────────────────────────────────────────────────────

def test_extracts_users():
    iam_client = make_iam_client(users=[{
        "UserId":   "AIDABC123",
        "UserName": "alice",
        "Arn":      "arn:aws:iam::123:user/alice",
    }])
    ext   = IAMExtractor(make_session(iam_client))
    users = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_USER]
    assert len(users) == 1
    assert users[0].name == "alice"


def test_user_mfa_detected():
    iam = MagicMock()

    def paginate_side_effect(method, **kwargs):
        pag = MagicMock()
        if method == "list_users":
            pag.paginate.return_value = iter([{"Users": [{
                "UserId":   "AIDABC",
                "UserName": "bob",
                "Arn":      "arn:aws:iam::123:user/bob",
            }]}])
        elif method == "list_roles":
            pag.paginate.return_value = iter([{"Roles": []}])
        elif method == "list_mfa_devices":
            pag.paginate.return_value = iter([{"MFADevices": [{"SerialNumber": "arn:mfa"}]}])
        elif method in ("list_attached_user_policies", "list_access_keys"):
            pag.paginate.return_value = iter([{"AttachedPolicies": [], "AccessKeyMetadata": []}])
        else:
            pag.paginate.return_value = iter([{}])
        return pag

    iam.get_paginator.side_effect = paginate_side_effect
    ext   = IAMExtractor(make_session(iam))
    users = [r for r in ext.extract() if r.resource_type == ResourceType.IAM_USER]
    assert users[0].metadata["has_mfa"] is True