# backend/extractor/lambda_.py
from .base import BaseExtractor, Resource, ResourceType

SENSITIVE_ENV_KEYS = [
    "password", "secret", "key", "token", "db_url",
    "database_url", "api_key", "credentials", "private"
]


class LambdaExtractor(BaseExtractor):

    def extract(self) -> list:
        resources = []

        for region in self.REGIONS:
            try:
                lam = self.session.client("lambda", region_name=region)

                for fn in self._paginate(lam, "list_functions", "Functions"):

                    env_vars = fn.get("Environment", {}).get("Variables", {})

                    sus_vars = {
                        k: "***"
                        for k, v in env_vars.items()
                        if any(s in k.lower() for s in SENSITIVE_ENV_KEYS)
                    }

                    role_arn = fn.get("Role", "")

                    has_url = bool(
                        self._safe(
                            lam.get_function_url_config,
                            FunctionName=fn["FunctionName"]
                        )
                    )

                    resources.append(
                        Resource(
                            resource_id=fn["FunctionArn"],
                            resource_type=ResourceType.LAMBDA_FUNCTION,
                            name=fn["FunctionName"],
                            arn=fn["FunctionArn"],
                            region=region,
                            account_id=self.account_id,
                            raw_config=fn,
                            internet_facing=has_url,
                            metadata={
                                "role_arn": role_arn,
                                "role_name": role_arn.split("/")[-1] if role_arn else None,
                                "suspicious_env": sus_vars,
                                "has_suspicious_env": bool(sus_vars),
                                "has_public_url": has_url,
                            }
                        )
                    )

            except Exception as e:
                # Optional: log instead of silent fail
                # log.warning(f"Lambda {region}: {e}")
                pass

        return resources