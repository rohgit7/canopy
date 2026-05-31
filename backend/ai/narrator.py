import os
import json
import logging
from openai import OpenAI  # xAI uses OpenAI-compatible SDK

from ..engine.attack_paths import AttackPath

log = logging.getLogger(__name__)

# Grok / xAI client
client = OpenAI(
    api_key=os.environ.get("XAI_API_KEY", ""),
    base_url="https://api.x.ai/v1"
)

SYSTEM = """You are a security consultant explaining an AWS attack path to a non-technical CEO.
Convert the technical data into plain English.
Respond ONLY with a JSON object — no markdown, no extra text, no code fences.
Required fields:
  headline (max 15 words),
  story (2-3 sentences, no jargon),
  business_impact (one sentence),
  fix (plain English, specific action),
  fix_time (e.g. 5 minutes),
  attacker_difficulty (Trivial/Easy/Moderate/Hard),
  time_to_exploit (e.g. 10 minutes).
Never say IAM, ARN, CIDR, boto3, EC2, S3.
Say 'permissions' not 'IAM role'.
Say 'file storage' not 'S3'.
Say 'server' not 'EC2'."""


def narrate_path(path: AttackPath) -> str:
    hops_text = "\n".join(
        f"  Step {i+1}: {h.description} (difficulty {h.weight:.1f}/1.0)"
        for i, h in enumerate(path.hops)
    )

    prompt = f"""Attack path details:
Target: {path.target_name} ({path.target_type})
Score: {path.score:.2f} | Blast radius: {path.blast_radius:.0f}/100 | Steps: {path.hop_count}

Chain:
{hops_text}

Write the JSON narrative."""

    try:
        resp = client.chat.completions.create(
            model="grok-2-latest",   # or "grok-1"
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )

        raw = resp.choices[0].message.content

        return raw.replace("```json", "").replace("```", "").strip()

    except Exception as e:
        log.error(f"Narration failed: {e}")
        return json.dumps({
            "headline": f"Attack path to {path.target_name}",
            "story": " → ".join(h.description for h in path.hops),
            "business_impact": "Review this finding manually.",
            "fix": "Investigate the permissions involved.",
            "fix_time": "Unknown",
            "error": str(e),
        })