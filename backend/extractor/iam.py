# backend/extractor/iam.py
import json
from urllib.parse import unquote
from .base import BaseExtractor, Resource, ResourceType
import logging

log = logging.getLogger(__name__)


class IAMExtractor(BaseExtractor):

    def extract(self) -> list:
        iam = self.session.client("iam")
        resources = []

        resources += self._extract_roles(iam)
        resources += self._extract_users(iam)

        log.info(f"IAM: {len(resources)} resources")
        return resources

    def _extract_roles(self, iam) -> list:
        roles = self._paginate(iam, "list_roles", "Roles")
        result = []

        for role in roles:
            name = role["RoleName"]

            attached = self._paginate(
                iam, "list_attached_role_policies",
                "AttachedPolicies", RoleName=name
            )

            inline_names = self._paginate(
                iam, "list_role_policies",
                "PolicyNames", RoleName=name
            )

            inline_docs = {}

            for pol_name in inline_names:
                resp = self._safe(
                    iam.get_role_policy,
                    RoleName=name,
                    PolicyName=pol_name
                )
                if resp:
                    doc = resp.get("PolicyDocument", {})
                    if isinstance(doc, str):
                        doc = json.loads(unquote(doc))
                    inline_docs[pol_name] = doc

            trust = role.get("AssumeRolePolicyDocument", {})
            if isinstance(trust, str):
                trust = json.loads(unquote(trust))

            is_admin = any(
                p.get("PolicyName") == "AdministratorAccess"
                for p in attached
            )

            result.append(
                Resource(
                    resource_id=role["RoleId"],
                    resource_type=ResourceType.IAM_ROLE,
                    name=name,
                    arn=role["Arn"],
                    region="global",
                    account_id=self.account_id,
                    raw_config=role,
                    is_sensitive=is_admin,
                    metadata={
                        "attached_policies": [p["PolicyArn"] for p in attached],
                        "attached_policy_names": [p["PolicyName"] for p in attached],
                        "inline_policy_docs": inline_docs,
                        "trust_policy": trust,
                        "is_admin": is_admin,
                        "trust_principals": self._extract_principals(trust),
                    }
                )
            )

        return result

    def _extract_users(self, iam) -> list:
        users = self._paginate(iam, "list_users", "Users")
        result = []

        for user in users:
            uname = user["UserName"]

            attached = self._paginate(
                iam, "list_attached_user_policies",
                "AttachedPolicies", UserName=uname
            )

            keys = self._paginate(
                iam, "list_access_keys",
                "AccessKeyMetadata", UserName=uname
            )

            mfa_devices = self._paginate(
                iam, "list_mfa_devices",
                "MFADevices", UserName=uname
            )

            result.append(
                Resource(
                    resource_id=user["UserId"],
                    resource_type=ResourceType.IAM_USER,
                    name=uname,
                    arn=user["Arn"],
                    region="global",
                    account_id=self.account_id,
                    raw_config=user,
                    metadata={
                        "attached_policies": [p["PolicyArn"] for p in attached],
                        "active_key_count": len(
                            [k for k in keys if k["Status"] == "Active"]
                        ),
                        "has_mfa": len(mfa_devices) > 0,
                    }
                )
            )

        return result

    def _extract_principals(self, trust_policy: dict) -> list:
        arns = []

        for stmt in trust_policy.get("Statement", []):
            if stmt.get("Effect") != "Allow":
                continue

            principal = stmt.get("Principal", {})

            if principal == "*":
                arns.append("*")

            elif isinstance(principal, dict):
                for val in principal.values():
                    if isinstance(val, str):
                        arns.append(val)
                    else:
                        arns.extend(val)

            elif isinstance(principal, str):
                arns.append(principal)

        return arns