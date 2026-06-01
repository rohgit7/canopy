import os
import json
import logging
import google.generativeai as genai

from ..engine.attack_paths import AttackPath

log = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

model = genai.GenerativeModel("gemini-2.5-flash")

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

    prompt = f"""{SYSTEM}

Attack path details:
Target: {path.target_name} ({path.target_type})
Score: {path.score:.2f} | Blast radius: {path.blast_radius:.0f}/100 | Steps: {path.hop_count}

Chain:
{hops_text}

Write the JSON narrative.
"""

    try:
        resp = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.3,
                "response_mime_type": "application/json",
            },
        )

        raw = resp.text.strip()

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