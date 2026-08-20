def spans_overlap(a: dict, b: dict) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


def _quality_key(match: dict) -> tuple[int, int, float, int]:
    length = match["end"] - match["start"]
    specialized = 1 if match.get("pattern_name") or match.get("validated") else 0
    return (
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
