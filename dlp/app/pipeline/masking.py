import re


_PLACEHOLDER_TYPE_LABELS = {
    "openai_api_key": "api_key",
}

_SYNAPSE_PLACEHOLDER_RE = re.compile(r"\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_\d+\]")
_NEUTRALIZED_SECRET_PREFIXES = {
    "sk-",
    "sk-proj-",
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_",
    "bearer",
    "bearer ",
}


def build_placeholder(match: dict) -> str:
    placeholder_id = match["id"]
    pii_type = match.get("type")
    replacement_type = _PLACEHOLDER_TYPE_LABELS.get(pii_type)
    if replacement_type and placeholder_id.startswith(f"{pii_type}_"):
        placeholder_id = placeholder_id.replace(pii_type, replacement_type, 1)
    return f"[{placeholder_id.upper()}]"


def is_synapse_placeholder(value: str) -> bool:
    return bool(_SYNAPSE_PLACEHOLDER_RE.fullmatch((value or "").strip()))


def is_neutralized_placeholder_value(value: str) -> bool:
    normalized = (value or "").strip().strip("'\"")
    if not normalized:
        return False
    if is_synapse_placeholder(normalized):
        return True

    without_placeholders = _SYNAPSE_PLACEHOLDER_RE.sub("", normalized)
    if without_placeholders == normalized:
        return False

    prefix = without_placeholders.strip().lower()
    return prefix in _NEUTRALIZED_SECRET_PREFIXES


def mask_text(text: str, matches: list[dict]) -> str:
    sorted_matches = sorted(matches, key=lambda m: m["start"], reverse=True)
    masked = text
    for match in sorted_matches:
        placeholder = build_placeholder(match)
        masked = masked[:match["start"]] + placeholder + masked[match["end"]:]
    return masked
