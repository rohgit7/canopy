import json
import logging
from urllib.parse import unquote

log = logging.getLogger(__name__)

HARDCODED_POLICIES = {
    "arn:aws:iam::aws:policy/AdministratorAccess": {
        "Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*"}]
    },
    "arn:aws:iam::aws:policy/ReadOnlyAccess": {
        "Statement": [{"Effect": "Allow", "Action": ["Get*", "List*", "Describe*"], "Resource": "*"}]
    },
    "arn:aws:iam::aws:policy/SecurityAudit": {
        "Statement": [{"Effect": "Allow", "Action": ["Get*", "List*", "Describe*"], "Resource": "*"}]
    },
}


class PolicyDocExtractor:

    def __init__(self, session):
        self.session = session

    def extract_docs(self, policy_arns: list = None) -> dict:
        iam    = self.session.client("iam")
        result = dict(HARDCODED_POLICIES)

        if not policy_arns:
            return result

        for arn in policy_arns:
            if arn in result:
                continue
            try:
                policy     = iam.get_policy(PolicyArn=arn)["Policy"]
                version_id = policy["DefaultVersionId"]
                version    = iam.get_policy_version(
                    PolicyArn=arn,
                    VersionId=version_id
                )["PolicyVersion"]
                doc = version["Document"]
                if isinstance(doc, str):
                    doc = json.loads(unquote(doc))
                result[arn] = doc
            except Exception as e:
                log.debug(f"Could not fetch policy {arn}: {e}")

        return result