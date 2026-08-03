import pytest
from unittest.mock import MagicMock
from backend.extractor.apigateway import APIGatewayExtractor
from backend.extractor.rds import RDSExtractor
from backend.extractor.base import ResourceType


def make_session(account_id="123456789012", regions=None):
    session = MagicMock()
    sts = MagicMock()
    sts.get_caller_identity.return_value = {"Account": account_id}
    ec2 = MagicMock()
    ec2.describe_regions.return_value = {
        "Regions": [{"RegionName": r} for r in (regions or ["us-east-1"])]
    }

    def client(name, region_name=None):
        if name == "sts":
            return sts
        if name == "ec2":
            return ec2
        return MagicMock()

    session.client.side_effect = client
    return session


def test_apigateway_extracts_rest_and_http_apis():
    session = make_session()
    apigw = MagicMock()
    apigw2 = MagicMock()

    rest_paginator = MagicMock()
    rest_paginator.paginate.return_value = iter([
        {"items": [{"id": "rest1", "name": "Legacy API"}]}
    ])
    apigw.get_paginator.return_value = rest_paginator

    v2_paginator = MagicMock()
    v2_paginator.paginate.return_value = iter([
        {"Items": [{"ApiId": "http1", "Name": "Orders", "ProtocolType": "HTTP"}]}
    ])
    apigw2.get_paginator.return_value = v2_paginator

    def client(name, region_name=None):
        if name == "sts":
            return session.client("sts")
        if name == "ec2":
            return session.client("ec2")
        if name == "apigateway":
            return apigw
        if name == "apigatewayv2":
            return apigw2
        return MagicMock()

    session.client.side_effect = client

    resources = APIGatewayExtractor(session).extract()
    types = {r.resource_type for r in resources}

    assert ResourceType.APIGATEWAY_REST in types
    assert ResourceType.APIGATEWAY_HTTP in types
    assert len(resources) == 2


def test_rds_extracts_instances_and_clusters():
    session = make_session()
    rds = MagicMock()

    instance_paginator = MagicMock()
    instance_paginator.paginate.return_value = iter([
        {
            "DBInstances": [{
                "DBInstanceIdentifier": "mydb",
                "DBInstanceArn": "arn:aws:rds:us-east-1:123:db:mydb",
                "Engine": "postgres",
                "PubliclyAccessible": True,
                "Endpoint": {"Address": "mydb.abc.rds.amazonaws.com", "Port": 5432},
            }]
        }
    ])

    cluster_paginator = MagicMock()
    cluster_paginator.paginate.return_value = iter([
        {
            "DBClusters": [{
                "DBClusterIdentifier": "mycluster",
                "DBClusterArn": "arn:aws:rds:us-east-1:123:cluster:mycluster",
                "Engine": "aurora-mysql",
                "PubliclyAccessible": False,
                "Endpoint": "mycluster.cluster-abc.rds.amazonaws.com",
            }]
        }
    ])

    def get_paginator(method):
        if method == "describe_db_instances":
            return instance_paginator
        if method == "describe_db_clusters":
            return cluster_paginator
        raise ValueError(method)

    rds.get_paginator.side_effect = get_paginator

    def client(name, region_name=None):
        if name == "sts":
            return session.client("sts")
        if name == "ec2":
            return session.client("ec2")
        if name == "rds":
            return rds
        return MagicMock()

    session.client.side_effect = client

    resources = RDSExtractor(session).extract()
    types = {r.resource_type for r in resources}

    assert ResourceType.RDS_INSTANCE in types
    assert ResourceType.RDS_CLUSTER in types
    assert len(resources) == 2
