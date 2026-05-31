from dataclasses import dataclass, field


@dataclass
class Condition:
    operator: str
    key:      str
    values:   list


@dataclass
class Statement:
    effect:        str
    actions:       list
    not_actions:   list
    resources:     list
    not_resources: list
    principals:    list
    conditions:    list = field(default_factory=list)
    sid:           str  = ""

    @property
    def is_allow(self): return self.effect == "Allow"

    @property
    def is_deny(self):  return self.effect == "Deny"


@dataclass
class Policy:
    statements: list
    version:    str = "2012-10-17"


class PolicyParser:

    def parse(self, doc: dict) -> Policy:
        if not doc:
            return Policy(statements=[])

        stmts = doc.get("Statement", [])
        if isinstance(stmts, dict):
            stmts = [stmts]

        return Policy(
            version    = doc.get("Version", "2012-10-17"),
            statements = [self._stmt(s) for s in stmts],
        )

    def _stmt(self, s: dict) -> Statement:
        return Statement(
            sid           = s.get("Sid", ""),
            effect        = s.get("Effect", "Allow"),
            actions       = self._ls(s.get("Action", [])),
            not_actions   = self._ls(s.get("NotAction", [])),
            resources     = self._ls(s.get("Resource", ["*"])),
            not_resources = self._ls(s.get("NotResource", [])),
            principals    = self._principal(s.get("Principal", [])),
            conditions    = self._conds(s.get("Condition", {})),
        )

    def _ls(self, v) -> list:
        if isinstance(v, str):  return [v]
        if isinstance(v, list): return v
        return []

    def _principal(self, p) -> list:
        if p == "*":              return ["*"]
        if isinstance(p, str):   return [p]
        if isinstance(p, list):  return p
        if isinstance(p, dict):
            out = []
            for val in p.values():
                out.extend([val] if isinstance(val, str) else val)
            return out
        return []

    def _conds(self, block: dict) -> list:
        out = []
        for op, kvs in block.items():
            for key, vals in kvs.items():
                out.append(Condition(
                    operator = op,
                    key      = key,
                    values   = self._ls(vals),
                ))
        return out