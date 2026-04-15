from .base import BaseExtractor, Resource, ResourceType
import logging

log = logging.getLogger(__name__)

DANGEROUS_PORTS = {
    22: "SSH",
    3389: "RDP",
    3306: "MySQL",
    5432: "PostgreSQL",
    27017: "MongoDB",
    6379: "Redis",
    9200: "Elasticsearch"
}


class EC2Extractor(BaseExtractor):

    def extract(self) -> list:
        resources = []

        for region in self.REGIONS:
            try:
                ec2 = self.session.client("ec2", region_name=region)
                resources += self._instances(ec2, region)
                resources += self._security_groups(ec2, region)
            except Exception as e:
                log.warning(f"EC2 {region}: {e}")

        return resources

    def _instances(self, ec2, region) -> list:
        reservations = self._paginate(ec2, "describe_instances", "Reservations")
        result = []

        for res in reservations:
            for inst in res.get("Instances", []):
                if inst["State"]["Name"] == "terminated":
                    continue

                tags = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
                name = tags.get("Name", inst["InstanceId"])
                pub_ip = inst.get("PublicIpAddress")
                iam_arn = inst.get("IamInstanceProfile", {}).get("Arn", "")

                result.append(
                    Resource(
                        resource_id=inst["InstanceId"],
                        resource_type=ResourceType.EC2_INSTANCE,
                        name=name,
                        arn=f"arn:aws:ec2:{region}:{self.account_id}:instance/{inst['InstanceId']}",
                        region=region,
                        account_id=self.account_id,
                        raw_config=inst,
                        tags=tags,
                        internet_facing=bool(pub_ip),
                        metadata={
                            "public_ip": pub_ip,
                            "private_ip": inst.get("PrivateIpAddress"),
                            "instance_type": inst.get("InstanceType"),
                            "state": inst["State"]["Name"],
                            "iam_role_name": iam_arn.split("/")[-1] if iam_arn else None,
                            "sg_ids": [
                                sg["GroupId"]
                                for sg in inst.get("SecurityGroups", [])
                            ],
                        }
                    )
                )

        return result

    def _security_groups(self, ec2, region) -> list:
        sgs = self._paginate(ec2, "describe_security_groups", "SecurityGroups")
        result = []

        for sg in sgs:
            dangerous = []
            open_world = False

            for rule in sg.get("IpPermissions", []):
                fp = rule.get("FromPort", 0)
                tp = rule.get("ToPort", 65535)

                for ipr in rule.get("IpRanges", []):
                    if ipr.get("CidrIp") in ("0.0.0.0/0", "::/0"):
                        open_world = True

                        for port, svc in DANGEROUS_PORTS.items():
                            if fp <= port <= tp or rule.get("IpProtocol") == "-1":
                                dangerous.append({
                                    "port": port,
                                    "service": svc
                                })

            result.append(
                Resource(
                    resource_id=sg["GroupId"],
                    resource_type=ResourceType.EC2_SG,
                    name=sg.get("GroupName", sg["GroupId"]),
                    arn=f"arn:aws:ec2:{region}:{self.account_id}:securitygroup/{sg['GroupId']}",
                    region=region,
                    account_id=self.account_id,
                    raw_config=sg,
                    internet_facing=open_world,
                    metadata={
                        "dangerous_rules": dangerous,
                        "open_to_world": open_world
                    }
                )
            )

        return result