import json
import re
import threading
from pathlib import Path

from app.detectors.luhn import is_luhn_valid
from app.detectors.iban import is_iban_valid

# Patterns live in patterns.json rather than as hardcoded constants here,
# so adding a new one is a data change, not a code change - see
# add_pattern() at the bottom. Overridable via PATTERNS_FILE for
# deployments that want to mount a persistent volume over the file baked
# into the image (otherwise runtime additions are lost on container
# rebuild).
import os
_PATTERNS_FILE = Path(os.environ.get("PATTERNS_FILE", Path(__file__).parent / "patterns.json"))

_VALID_SEVERITIES = {"high", "medium", "low"}

# Named, reusable post-match checks a pattern can opt into via its
# "validator" field. Arbitrary Python logic can't live in JSON, so this is
# the escape hatch: patterns.json says *which* named check to run, the
# actual logic stays here. Same idea as Luhn on credit cards, just made
# pluggable for any future pattern that needs more than "the regex
# matched" (see iban_morocco's MOD-97 check for another example).
_VALIDATORS = {
    "luhn": is_luhn_valid,
    "iban_checksum": is_iban_valid,
    "mixed_case": lambda v: any(c.isupper() for c in v) and any(c.islower() for c in v),
}

_rules_lock = threading.Lock()


def _compile_rule(entry: dict) -> dict:
    """Turns one patterns.json entry into a ready-to-use rule: same
    fields, but with the regex precompiled and the validator name
    resolved to an actual function - both done once here rather than on
    every call to run_regex_detectors."""
    missing = [f for f in ("name", "type", "pattern") if f not in entry]
    if missing:
        raise ValueError(f"Pattern entry {entry} is missing required field(s): {missing}")

    severity = entry.get("severity", "medium")
    if severity not in _VALID_SEVERITIES:
        raise ValueError(
            f"Pattern '{entry['name']}' has severity '{severity}', "
            f"must be one of {sorted(_VALID_SEVERITIES)}"
        )

    validator_name = entry.get("validator")
    if validator_name is not None and validator_name not in _VALIDATORS:
        raise ValueError(
            f"Pattern '{entry['name']}' references unknown validator "
            f"'{validator_name}'. Known validators: {sorted(_VALIDATORS)}"
        )

    try:
        regex = re.compile(entry["pattern"])
    except re.error as e:
        raise ValueError(f"Pattern '{entry['name']}' has invalid regex: {e}") from e

    return {
        "name": entry["name"],
        "type": entry["type"],
        "regex": regex,
        "severity": severity,
        "validator": _VALIDATORS.get(validator_name),
        # Optional: report a specific capture group's span instead of the
        # whole match. Needed for label-anchored patterns like "Nom: X" -
        # the label has to be part of the pattern to anchor the match, but
        # only X should be reported/masked, not "Nom: X" as one span.
        # None (default) keeps today's behavior: report the whole match.
        "capture_group": entry.get("capture_group"),
    }


def load_patterns(path: Path = _PATTERNS_FILE) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [_compile_rule(entry) for entry in data.get("patterns", [])]


_rules = load_patterns()


def _rules_of_type(pii_type: str) -> list[dict]:
    return [r for r in _rules if r["type"] == pii_type]


def _run_rules(rules: list[dict], text: str) -> list[dict]:
    matches = []
    for rule in rules:
        for match in rule["regex"].finditer(text):
            group = rule["capture_group"]
            if group is not None:
                if match.group(group) is None:
                    # Group exists in the pattern but didn't participate in
                    # this particular match (e.g. an optional alternation
                    # branch) - nothing to report for this match.
                    continue
                value = match.group(group)
                start, end = match.start(group), match.end(group)
            else:
                value = match.group()
                start, end = match.start(), match.end()

            if rule["validator"] and not rule["validator"](value):
                continue
            matches.append({
                "type": rule["type"], "value": value,
                "start": start, "end": end,
                "severity": rule["severity"], "source": "regex",
            })
    return matches


def detect_emails(text: str) -> list[dict]:
    return _run_rules(_rules_of_type("email"), text)


def detect_phones(text: str) -> list[dict]:
    return _run_rules(_rules_of_type("phone"), text)


def detect_credit_cards(text: str) -> list[dict]:
    return _run_rules(_rules_of_type("credit_card"), text)


def detect_api_keys(text: str) -> list[dict]:
    return _run_rules(_rules_of_type("api_key"), text)


def run_regex_detectors(text: str) -> list[dict]:
    return _run_rules(_rules, text)


def add_pattern(
    name: str,
    pii_type: str,
    pattern: str,
    severity: str = "medium",
    validator: str | None = None,
    path: Path = _PATTERNS_FILE,
) -> None:
    """
    Registers a new detection pattern without touching this file:
    validates it, appends it to patterns.json, and activates it
    immediately in the running process (no restart needed).

    validator, if given, must be one of the names in _VALIDATORS above -
    add a Python function there first if you need a new kind of check.
    """
    if severity not in _VALID_SEVERITIES:
        raise ValueError(f"severity must be one of {sorted(_VALID_SEVERITIES)}, got '{severity}'")
    if validator is not None and validator not in _VALIDATORS:
        raise ValueError(f"Unknown validator '{validator}'. Known validators: {sorted(_VALIDATORS)}")
    try:
        re.compile(pattern)
    except re.error as e:
        raise ValueError(f"'{pattern}' is not a valid regex: {e}") from e

    with _rules_lock:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"patterns": []}

        patterns = data.setdefault("patterns", [])
        if any(p["name"] == name for p in patterns):
            raise ValueError(f"A pattern named '{name}' already exists - use a different name.")

        entry = {"name": name, "type": pii_type, "pattern": pattern, "severity": severity}
        if validator:
            entry["validator"] = validator
        patterns.append(entry)

        # Write to a temp file and rename over the original (atomic on
        # POSIX) rather than truncating it in place, so a crash mid-write
        # can't leave patterns.json half-written and unparseable on the
        # next startup.
        tmp_path = path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        tmp_path.replace(path)

        _rules.append(_compile_rule(entry))
