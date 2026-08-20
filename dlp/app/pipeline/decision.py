SEVERITY_ORDER = {"low": 1, "medium": 2, "high": 3}


def evaluate_decision(matches: list[dict], analysis_error: bool = False) -> str:
    if analysis_error:
        return "BLOCK"
    # Confidence determines whether a finding exists; severity determines this
    # policy outcome. Only high-severity findings block the request.
    if any(SEVERITY_ORDER.get(str(match.get("severity", "")).lower(), 3) >= SEVERITY_ORDER["high"] for match in matches):
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
