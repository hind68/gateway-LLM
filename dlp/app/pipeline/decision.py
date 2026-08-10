SEVERITY_ORDER = {"low": 1, "medium": 2, "high": 3}


def evaluate_decision(matches: list[dict], analysis_error: bool = False) -> str:
    if analysis_error:
        return "BLOCK"
    if any(match.get("action") == "BLOCK" for match in matches):
        return "BLOCK"
    if any(match.get("severity") == "high" and match.get("action") != "ALLOW" for match in matches):
        return "BLOCK"
    if matches:
        return "MASK"
    return "ALLOW"


def highest_severity(matches: list[dict]) -> str | None:
    if not matches:
        return None
    return max(
        (match.get("severity", "low") for match in matches),
        key=lambda severity: SEVERITY_ORDER.get(severity, 0),
    )


def strip_sensitive_values(matches: list[dict]) -> list[dict]:
    return [{key: value for key, value in match.items() if key != "value"} for match in matches]
