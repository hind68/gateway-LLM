def spans_overlap(a: dict, b: dict) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


_GENERIC_TYPES = {"alphanumeric_identifier", "hardcoded_secret", "api_key"}
_EXPLICIT_PATTERN_PRIORITY = {
    "imei_contextual",
    "url_embedded_password",
    "curl_basic_password",
    "sql_literal_password",
    "infrastructure_secret_assignment",
}


def _quality_key(match: dict) -> tuple[int, int, int, int, float, int]:
    length = match["end"] - match["start"]
    specialized = 1 if match.get("pattern_name") or match.get("validated") else 0
    return (
        1 if match.get("pattern_name") in _EXPLICIT_PATTERN_PRIORITY else 0,
        0 if match.get("type") in _GENERIC_TYPES else 1,
        specialized,
        1 if match.get("validated") else 0,
        float(match.get("score") or 0),
        length,
    )


def deduplicate_matches(matches: list[dict]) -> list[dict]:
    result = []
    ordered = sorted(matches, key=lambda match: (_quality_key(match), -(match["end"] - match["start"])), reverse=True)
    for match in ordered:
        if any(spans_overlap(match, kept) for kept in result):
            continue
        result.append(match)
    return sorted(result, key=lambda match: match["start"])
