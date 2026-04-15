import fnmatch


def action_matches(pattern: str, action: str) -> bool:
    if pattern == "*":
        return True
    return fnmatch.fnmatch(action.lower(), pattern.lower())


def resource_matches(pattern: str, arn: str) -> bool:
    if pattern == "*" or arn == "*":
        return True
    return fnmatch.fnmatch(arn.lower(), pattern.lower())


def principal_matches(pattern: str, arn: str) -> bool:
    if pattern == "*":
        return True
    return resource_matches(pattern, arn)