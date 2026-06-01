import pytest
import boto3
from unittest.mock import MagicMock, patch
from backend.extractor.base import BaseExtractor, Resource, ResourceType


def make_session():
    session = MagicMock()
    sts = MagicMock()
    sts.get_caller_identity.return_value = {"Account": "123456789012"}
    session.client.return_value = sts
    return session


def test_get_account_id():
    ext = BaseExtractor(make_session())
    assert ext.account_id == "123456789012"


def test_get_account_id_fails_gracefully():
    session = MagicMock()
    session.client.return_value.get_caller_identity.side_effect = Exception("no creds")
    ext = BaseExtractor(session)
    assert ext.account_id == "unknown"


def test_safe_returns_value():
    ext = BaseExtractor(make_session())
    result = ext._safe(lambda: {"key": "val"})
    assert result == {"key": "val"}


def test_safe_returns_default_on_error():
    ext = BaseExtractor(make_session())
    result = ext._safe(lambda: (_ for _ in ()).throw(Exception("boom")), default="fallback")
    assert result == "fallback"


def test_safe_returns_none_by_default_on_error():
    ext = BaseExtractor(make_session())
    def boom(): raise Exception("boom")
    result = ext._safe(boom)
    assert result is None


def test_resource_to_dict():
    r = Resource(
        resource_id    = "ec2-abc",
        resource_type  = ResourceType.EC2_INSTANCE,
        name           = "WebServer",
        arn            = "arn:aws:ec2:ap-south-1:123:instance/i-abc",
        region         = "ap-south-1",
        account_id     = "123456789012",
        internet_facing= True,
        is_sensitive   = False,
        metadata       = {"public_ip": "52.66.1.1"},
    )
    d = r.to_dict()
    assert d["resource_id"]     == "ec2-abc"
    assert d["resource_type"]   == "ec2:instance"
    assert d["internet_facing"] == True
    assert d["metadata"]["public_ip"] == "52.66.1.1"


def test_resource_type_values():
    assert ResourceType.EC2_INSTANCE.value    == "ec2:instance"
    assert ResourceType.S3_BUCKET.value       == "s3:bucket"
    assert ResourceType.IAM_ROLE.value        == "iam:role"
    assert ResourceType.LAMBDA_FUNCTION.value == "lambda:function"
    assert ResourceType.INTERNET.value        == "pseudo:internet"


def test_paginate_collects_all_pages():
    client = MagicMock()
    page1  = {"Roles": [{"RoleName": "A"}, {"RoleName": "B"}]}
    page2  = {"Roles": [{"RoleName": "C"}]}
    paginator = MagicMock()
    paginator.paginate.return_value = iter([page1, page2])
    client.get_paginator.return_value = paginator

    ext = BaseExtractor(make_session())
    result = ext._paginate(client, "list_roles", "Roles")
    assert len(result) == 3
    assert result[0]["RoleName"] == "A"
    assert result[2]["RoleName"] == "C"


def test_paginate_returns_empty_on_error():
    client = MagicMock()
    client.get_paginator.side_effect = Exception("access denied")
    ext    = BaseExtractor(make_session())
    result = ext._paginate(client, "list_roles", "Roles")
    assert result == []


def test_paginate_handles_empty_page():
    client    = MagicMock()
    paginator = MagicMock()
    paginator.paginate.return_value = iter([{"Roles": []}])
    client.get_paginator.return_value = paginator
    ext    = BaseExtractor(make_session())
    result = ext._paginate(client, "list_roles", "Roles")
    assert result == []