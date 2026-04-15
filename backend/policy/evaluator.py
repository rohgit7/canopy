import fnmatch
import logging
from dataclasses import dataclass
from .parser import PolicyParser, Statement
from .wildcard import action_matches, resource_matches, principal_matches

log    = logging.getLogger(__name__)
parser = PolicyParser()


@dataclass
class EvalResult:
    decision:    str
    reason:      str
    matched_sid: str = ""

    @property
    def allowed(self) -> bool:
        return self.decision == "ALLOW"


class PolicyEvaluator:

    def evaluate(self,
                 principal_arn:     str,
                 action:            str,
                 resource_arn:      str,
                 identity_policies: list,
                 resource_policy:   dict = None,
                 context:           dict = None) -> EvalResult:

        context   = context or {}
        id_parsed = [parser.parse(p) for p in (identity_policies or [])]

        # ── PASS 1: Explicit DENY scan ────────────────────────────────────────
        for pol in id_parsed:
            for stmt in pol.statements:
                if not stmt.is_deny:
                    continue
                if self._matches(stmt, principal_arn, action, resource_arn, context):
                    return EvalResult(
                        decision    = "DENY",
                        reason      = f"Explicit Deny: {stmt.sid or 'no sid'}",
                        matched_sid = stmt.sid,
                    )

        # ── PASS 2: Explicit ALLOW scan ───────────────────────────────────────
        for pol in id_parsed:
            for stmt in pol.statements:
                if not stmt.is_allow:
                    continue
                if self._matches(stmt, principal_arn, action, resource_arn, context):
                    return EvalResult(
                        decision    = "ALLOW",
                        reason      = f"Allowed by: {stmt.sid or 'no sid'}",
                        matched_sid = stmt.sid,
                    )

        # ── Implicit DENY ─────────────────────────────────────────────────────
        return EvalResult(
            decision    = "DENY",
            reason      = f"No matching Allow for {action} on {resource_arn}",
            matched_sid = "",
        )

    def _matches(self,
                 stmt:          Statement,
                 principal_arn: str,
                 action:        str,
                 resource_arn:  str,
                 context:       dict) -> bool:

        # Principal check
        if stmt.principals:
            if not any(principal_matches(p, principal_arn) for p in stmt.principals):
                return False

        # Action check
        if stmt.not_actions:
            if any(action_matches(na, action) for na in stmt.not_actions):
                return False
        elif stmt.actions:
            if not any(action_matches(a, action) for a in stmt.actions):
                return False

        # Resource check
        if stmt.not_resources:
            if any(resource_matches(nr, resource_arn) for nr in stmt.not_resources):
                return False
        elif stmt.resources:
            if not any(resource_matches(r, resource_arn) for r in stmt.resources):
                return False

        # Condition check
        for cond in stmt.conditions:
            if not self._eval_condition(cond, context):
                return False

        return True

    def _eval_condition(self, cond, context: dict) -> bool:
        op  = cond.operator.lower()
        val = context.get(cond.key)

        if val is None:
            return "ifexists" in op

        ctx_vals = [val] if isinstance(val, str) else val

        if "stringequals" in op and "not" not in op:
            return any(c.lower() == v.lower()
                       for c in ctx_vals for v in cond.values)

        elif "stringnotequals" in op:
            return all(c.lower() != v.lower()
                       for c in ctx_vals for v in cond.values)

        elif "stringlike" in op and "not" not in op:
            return any(fnmatch.fnmatch(c.lower(), v.lower())
                       for c in ctx_vals for v in cond.values)

        elif "bool" in op:
            return any(str(c).lower() == v.lower()
                       for c in ctx_vals for v in cond.values)

        elif "arnlike" in op:
            return any(fnmatch.fnmatch(c.lower(), v.lower())
                       for c in ctx_vals for v in cond.values)

        elif "arnequals" in op:
            return any(c.lower() == v.lower()
                       for c in ctx_vals for v in cond.values)

        elif "null" in op:
            expected = cond.values[0].lower() == "true" if cond.values else False
            return (val is None) == expected

        else:
            log.debug(f"Unknown condition operator: {cond.operator}")
            return True

    def has_permission(self, policies: list, action: str,
                       resource: str = "*") -> bool:
        return self.evaluate("*", action, resource, policies).allowed