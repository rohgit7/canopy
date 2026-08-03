# backend/extractor/rds.py
import logging
from .base import BaseExtractor, Resource, ResourceType

log = logging.getLogger(__name__)


class RDSExtractor(BaseExtractor):

    def extract(self) -> list:
        resources = []
        for region in self.REGIONS:
            resources.extend(self._extract_instances(region))
            resources.extend(self._extract_clusters(region))
        return resources

    def _extract_instances(self, region: str) -> list:
        resources = []
        try:
            client = self.session.client("rds", region_name=region)
            db_instances = self._paginate(
                client, "describe_db_instances", "DBInstances"
            )
            for db in db_instances:
                db_id = db.get("DBInstanceIdentifier")
                if not db_id:
                    continue

                arn = db.get(
                    "DBInstanceArn",
                    f"arn:aws:rds:{region}:{self.account_id}:db:{db_id}",
                )
                engine = db.get("Engine", "unknown")
                publicly_accessible = db.get("PubliclyAccessible", False)
                endpoint_info = db.get("Endpoint", {})
                address = endpoint_info.get("Address", "")
                port = endpoint_info.get("Port", 3306)
                vpc_sgs = [
                    sg.get("VpcSecurityGroupId")
                    for sg in db.get("VpcSecurityGroups", [])
                    if sg.get("VpcSecurityGroupId")
                ]

                resources.append(
                    Resource(
                        resource_id=db_id,
                        resource_type=ResourceType.RDS_INSTANCE,
                        name=f"RDS: {db_id}",
                        arn=arn,
                        region=region,
                        account_id=self.account_id,
                        raw_config=db,
                        internet_facing=publicly_accessible,
                        is_sensitive=True,
                        metadata={
                            "db_instance_identifier": db_id,
                            "engine": engine,
                            "engine_version": db.get("EngineVersion", ""),
                            "endpoint_address": address,
                            "port": port,
                            "publicly_accessible": publicly_accessible,
                            "vpc_security_groups": vpc_sgs,
                            "multi_az": db.get("MultiAZ", False),
                            "storage_encrypted": db.get("StorageEncrypted", False),
                        },
                    )
                )
        except Exception as e:
            log.warning(f"RDS instance extraction failed in {region}: {e}")
        return resources

    def _extract_clusters(self, region: str) -> list:
        resources = []
        try:
            client = self.session.client("rds", region_name=region)
            clusters = self._paginate(
                client, "describe_db_clusters", "DBClusters"
            )
            for cluster in clusters:
                cluster_id = cluster.get("DBClusterIdentifier")
                if not cluster_id:
                    continue

                arn = cluster.get(
                    "DBClusterArn",
                    f"arn:aws:rds:{region}:{self.account_id}:cluster:{cluster_id}",
                )
                publicly_accessible = cluster.get("PubliclyAccessible", False)
                endpoint_info = cluster.get("Endpoint", {})
                reader_endpoint = cluster.get("ReaderEndpoint", "")

                resources.append(
                    Resource(
                        resource_id=cluster_id,
                        resource_type=ResourceType.RDS_CLUSTER,
                        name=f"RDS Cluster: {cluster_id}",
                        arn=arn,
                        region=region,
                        account_id=self.account_id,
                        raw_config=cluster,
                        internet_facing=publicly_accessible,
                        is_sensitive=True,
                        metadata={
                            "db_cluster_identifier": cluster_id,
                            "engine": cluster.get("Engine", "unknown"),
                            "engine_version": cluster.get("EngineVersion", ""),
                            "endpoint_address": endpoint_info,
                            "reader_endpoint": reader_endpoint,
                            "publicly_accessible": publicly_accessible,
                            "multi_az": cluster.get("MultiAZ", False),
                            "storage_encrypted": cluster.get("StorageEncrypted", False),
                        },
                    )
                )
        except Exception as e:
            log.warning(f"RDS cluster extraction failed in {region}: {e}")
        return resources
