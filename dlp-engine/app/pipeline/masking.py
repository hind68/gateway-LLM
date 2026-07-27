def build_placeholder(match: dict) -> str:
    return f"[{match['id'].upper()}_REDACTED]"


def mask_text(text: str, matches: list[dict]) -> str:
    sorted_matches = sorted(matches, key=lambda m: m["start"], reverse=True)
    masked = text
    for match in sorted_matches:
        placeholder = build_placeholder(match)
        masked = masked[:match["start"]] + placeholder + masked[match["end"]:]
    return masked