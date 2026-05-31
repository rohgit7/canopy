# backend/extractor/orchestrator.py
import boto3
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from .iam import IAMExtractor
from .ec2 import EC2Extractor
from .s3 import S3Extractor
from .lambda_ import LambdaExtractor

log = logging.getLogger(__name__)

EXTRACTORS = [IAMExtractor, EC2Extractor, S3Extractor, LambdaExtractor]


def extract_all(role_arn: str = None) -> list:
    """
    Main extraction entry point.
    role_arn: if provided, assume that role (scan a customer account).
    if None, use default credentials (scan your own account).
    """

    session = _assume_role(role_arn) if role_arn else boto3.Session()

    if not session:
        raise RuntimeError("Could not create AWS session")

    all_resources = []

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {
            ex.submit(cls(session).extract): cls.__name__
            for cls in EXTRACTORS
        }

        for future in as_completed(futures):
            name = futures[future]

            try:
                res = future.result(timeout=120)
                all_resources.extend(res)
                log.info(f"{name}: {len(res)} resources")

            except Exception as e:
                log.error(f"{name} FAILED: {e}")

    log.info(f"Total: {len(all_resources)} resources")
    return all_resources


def _assume_role(role_arn: str):
    try:
        sts = boto3.client("sts")

        creds = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName="CanopyScanner"
        )["Credentials"]

        return boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )

    except Exception as e:
        log.error(f"Role assumption failed: {e}")
        return None