# backend/extractor/base.py
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import boto3, logging

log = logging.getLogger(__name__)

class ResourceType(Enum):
    EC2_INSTANCE = "ec2:instance"
    EC2_SG = "ec2:security_group"
    S3_BUCKET = "s3:bucket"
    IAM_ROLE = "iam:role"
    IAM_USER = "iam:user"
    LAMBDA_FUNCTION = "lambda:function"
    INTERNET = "pseudo:internet"

@dataclass
class Resource:
    resource_id: str
    resource_type: ResourceType
    name: str
    arn: str
    region: str
    account_id: str
    raw_config: dict = field(default_factory=dict)
    tags: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
    internet_facing: bool = False
    is_sensitive: bool = False

    def to_dict(self) -> dict:
        return {
            "resource_id": self.resource_id,
            "resource_type": self.resource_type.value,
            "name": self.name,
            "arn": self.arn,
            "region": self.region,
            "account_id": self.account_id,
            "internet_facing": self.internet_facing,
            "is_sensitive": self.is_sensitive,
            "metadata": self.metadata,
        }
 

class BaseExtractor:
    REGIONS = ["ap-south-1", "us-east-1", "us-west-2", "eu-west-1"]

    def __init__(self, session: boto3.Session):
        self.session = session
        self.account_id = self._get_account_id()

    def _get_account_id(self) -> str:
        try:
            return self.session.client("sts").get_caller_identity()["Account"]
        except Exception:
            return "unknown"

    def extract(self) -> list:
        raise NotImplementedError

    def _paginate(self, client, method: str, key: str, **kwargs) -> list:
        """Fetch ALL pages from a paginated AWS API."""
        results = []
        try:
            paginator = client.get_paginator(method)
            for page in paginator.paginate(**kwargs):
                results.extend(page.get(key, []))
        except Exception as e:
            log.debug(f"Pagination error ({method}): {e}")
        return results

    def _safe(self, fn, default=None, **kwargs):
        """Call an AWS API safely — return default on any error."""
        try:
            return fn(**kwargs)
        except Exception as e:
            log.debug(f"AWS call failed: {e}")
            return default