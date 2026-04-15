import logging
from .builder import CanopyGraph, Edge, EdgeType, EDGE_WEIGHTS
from ..extractor.base import ResourceType
from ..policy.evaluator import PolicyEvaluator

log       = logging.getLogger(__name__)
evaluator = PolicyEvaluator()

CRITICAL_ACTIONS = {
    "s3:GetObject":              "s3",
    "s3:PutObject":              "s3",
    "s3:DeleteObject":           "s3",
    "lambda:InvokeFunction":     "lambda",
    "lambda:UpdateFunctionCode": "lambda",
    "iam:AttachRolePolicy":      "iam",
    "iam:CreateAccessKey":       "iam",
    "iam:PassRole":              "iam",
}

SERVICE_MAP = {
    ResourceType.S3_BUCKET:       "s3",
    ResourceType.LAMBDA_FUNCTION: "lambda",
    ResourceType.IAM_ROLE:        "iam",
    ResourceType.IAM_USER:        "iam",
}


def add_policy_edges(graph: CanopyGraph, resources: list,
                     policies_by_arn: dict):

    roles = [r for r in resources if r.resource_type == ResourceType.IAM_ROLE]

    for role in roles:
        policies = []

        for doc in role.metadata.get("inline_policy_docs", {}).values():
            policies.append(doc)

        for arn in role.metadata.get("attached_policies", []):
            if arn in policies_by_arn:
                policies.append(policies_by_arn[arn])

        if not policies:
            continue

        for target in resources:
            if target.resource_id == role.resource_id:
                continue

            target_service = SERVICE_MAP.get(target.resource_type)
            if not target_service:
                continue

            for action, service in CRITICAL_ACTIONS.items():
                if service != target_service:
                    continue

                result = evaluator.evaluate(
                    principal_arn     = role.arn,
                    action            = action,
                    resource_arn      = target.arn,
                    identity_policies = policies,
                )

                if result.allowed:
                    graph.add_edge(Edge(
                        source_id  = role.resource_id,
                        target_id  = target.resource_id,
                        edge_type  = EdgeType.CAN_ACCESS,
                        weight     = EDGE_WEIGHTS[EdgeType.CAN_ACCESS],
                        properties = {
                            "action":       action,
                            "description":  f"{role.name} can {action} on {target.name}",
                            "eval_reason":  result.reason,
                            "matched_sid":  result.matched_sid,
                        },
                    ))
                    break