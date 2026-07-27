"""
Shared logic for splitting a structured file's cells into two buckets by
column header, so the caller can send each bucket through a different
(cost/accuracy) tier of detection:

- "known" columns (header looks like email/phone/id/iban/...) only need
  the regex engine - a column literally named "email" doesn't need a
  ~700MB NER model to tell you it's an email.
- everything else is treated as free text and gets the full regex + NER
  pipeline, since that's where names/addresses/organizations - the
  things regex can't reliably catch - actually show up.

This is a heuristic on the header text, not a guarantee: a free-text
column with a misleading header (or no header at all) just means that
column's contents get the full, more expensive treatment - the safer
side to be wrong on, so ambiguous headers default to "free text" rather
than "known".
"""

import re

_KNOWN_TYPE_HEADER_KEYWORDS = frozenset({
    "email", "mail", "phone", "tel", "telephone", "mobile", "gsm",
    "ssn", "cin", "iban", "rib", "account", "compte",
    "card", "credit", "bic", "swift", "passport", "license",
    "code", "number", "num", "zip", "postal", "id",
})


def classify_columns(headers: list[str]) -> list[bool]:
    """Returns one bool per header: True = route to regex only, False =
    free text, route through the full pipeline. Ambiguous/unrecognized
    headers default to False (free text) - see module docstring.

    Headers are split into whole words (on whitespace/underscore/hyphen)
    and matched exactly against the keyword list, rather than checked as
    raw substrings - substring containment alone would misclassify a
    column called "Video" (contains "id") or "Hotel" (contains "tel") as
    a known PII column. This does mean camelCase headers with no
    separator at all (e.g. "phoneNumber") won't split into two words and
    may be missed - uncommon enough for CSV/XLSX headers specifically
    that it wasn't worth the extra complexity of camelCase-aware
    splitting, but worth knowing if your headers use that convention.
    """
    result = []
    for header in headers:
        words = set(re.split(r"[^a-z0-9]+", (header or "").strip().lower()))
        words.discard("")
        result.append(bool(words & _KNOWN_TYPE_HEADER_KEYWORDS))
    return result
