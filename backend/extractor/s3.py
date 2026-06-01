# backend/extractor/s3.py
import json
from .base import BaseExtractor, Resource, ResourceType


class S3Extractor(BaseExtractor):

    def extract(self) -> list:
        s3 = self.session.client("s3")
        buckets = self._safe(s3.list_buckets, {}).get("Buckets", [])
        result = []

        sensitive_kw = ["prod", "backup", "db", "secret", "key", "data", "private","test","s3"]

        for b in buckets:
            name = b["Name"]

            public = self._is_public(s3, name)
            policy = self._get_policy(s3, name)

            result.append(
                Resource(
                    resource_id=name,
                    resource_type=ResourceType.S3_BUCKET,
                    name=name,
                    arn=f"arn:aws:s3:::{name}",
                    region=self._region(s3, name),
                    account_id=self.account_id,
                    internet_facing=public,
                    is_sensitive=any(k in name.lower() for k in sensitive_kw),
                    metadata={
                        "is_public": public,
                        "has_policy": bool(policy),
                        "bucket_policy": policy
                    }
                )
            )

        return result

    def _is_public(self, s3, name) -> bool:
        try:
            acl = s3.get_bucket_acl(Bucket=name)
            return any(
                "AllUsers" in g.get("Grantee", {}).get("URI", "")
                for g in acl.get("Grants", [])
            )
        except Exception:
            return False

    def _get_policy(self, s3, name):
        try:
            return json.loads(
                s3.get_bucket_policy(Bucket=name)["Policy"]
            )
        except Exception:
            return None

    def _region(self, s3, name) -> str:
        try:
            loc = s3.get_bucket_location(Bucket=name).get("LocationConstraint")
            return loc or "us-east-1"
        except Exception:
            return "unknown"