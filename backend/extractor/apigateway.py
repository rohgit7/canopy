# backend/extractor/apigateway.py
import logging
from .base import BaseExtractor, Resource, ResourceType

log = logging.getLogger(__name__)


class APIGatewayExtractor(BaseExtractor):

    def extract(self) -> list:
        resources = []
        for region in self.REGIONS:
            resources.extend(self._extract_rest_apis(region))
            resources.extend(self._extract_v2_apis(region))
        return resources

    def _extract_rest_apis(self, region: str) -> list:
        resources = []
        try:
            client = self.session.client("apigateway", region_name=region)
            apis = self._paginate(client, "get_rest_apis", "items")
            for api in apis:
                api_id = api.get("id")
                if not api_id:
                    continue

                name = api.get("name", f"API-{api_id}")
                arn = f"arn:aws:apigateway:{region}::/restapis/{api_id}"
                endpoint_types = api.get("endpointConfiguration", {}).get(
                    "types", ["REGIONAL"]
                )
                is_public = any(t in ["REGIONAL", "EDGE"] for t in endpoint_types)

                resources.append(
                    Resource(
                        resource_id=api_id,
                        resource_type=ResourceType.APIGATEWAY_REST,
                        name=f"API: {name}",
                        arn=arn,
                        region=region,
                        account_id=self.account_id,
                        raw_config=api,
                        internet_facing=is_public,
                        is_sensitive=False,
                        metadata={
                            "api_id": api_id,
                            "api_name": name,
                            "protocol": "REST",
                            "endpoint_types": endpoint_types,
                            "api_key_source": api.get("apiKeySource", "HEADER"),
                            "created_date": str(api.get("createdDate", "")),
                        },
                    )
                )
        except Exception as e:
            log.warning(f"API Gateway REST extraction failed in {region}: {e}")
        return resources

    def _extract_v2_apis(self, region: str) -> list:
        resources = []
        try:
            client = self.session.client("apigatewayv2", region_name=region)
            apis = self._paginate(client, "get_apis", "Items")
            for api in apis:
                api_id = api.get("ApiId")
                if not api_id:
                    continue

                protocol = api.get("ProtocolType", "HTTP")
                if protocol == "HTTP":
                    resource_type = ResourceType.APIGATEWAY_HTTP
                elif protocol == "WEBSOCKET":
                    resource_type = ResourceType.APIGATEWAY_WS
                else:
                    continue

                name = api.get("Name", f"API-{api_id}")
                arn = f"arn:aws:apigateway:{region}::/apis/{api_id}"
                is_public = not api.get("DisableExecuteApiEndpoint", False)

                resources.append(
                    Resource(
                        resource_id=api_id,
                        resource_type=resource_type,
                        name=f"API: {name}",
                        arn=arn,
                        region=region,
                        account_id=self.account_id,
                        raw_config=api,
                        internet_facing=is_public,
                        is_sensitive=False,
                        metadata={
                            "api_id": api_id,
                            "api_name": name,
                            "protocol": protocol,
                            "api_endpoint": api.get("ApiEndpoint", ""),
                            "created_date": str(api.get("CreatedDate", "")),
                        },
                    )
                )
        except Exception as e:
            log.warning(f"API Gateway v2 extraction failed in {region}: {e}")
        return resources
