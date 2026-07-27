def spans_overlap(a: dict, b: dict) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


def deduplicate_matches(matches: list[dict]) -> list[dict]:
    result = []
    for match in matches:
        overlap_index = None
        for i, kept in enumerate(result):
            if spans_overlap(match, kept):
                overlap_index = i
                break

        if overlap_index is None:
            result.append(match)
        elif match.get("source") == "regex" and result[overlap_index].get("source") == "presidio":
            # Prefer the regex hit: it's a deterministic pattern match, so
            # for the PII types both detectors can find (email, phone,
            # credit card) it's more precise than the ML-based guess.
            result[overlap_index] = match
    return result