# app/detectors/banned_words.py
import re


def detect_banned_words(text: str, banned_words: list[str]) -> list[dict]:
    r"""
    Flags admin-supplied banned words (per-request, from Postgres - global
    + per-user lists), kept deliberately separate from regex_detector.py's
    persistent pattern registry, which is for durable, shared rules.

    Each word is escaped via re.escape() so literal characters in the
    banned word (".", "(", etc.) can't act as regex syntax.

    Uses (?<!\w)/(?!\w) rather than \b for boundaries: \b requires a
    word/non-word transition exactly at the boundary, which fails
    whenever the banned word itself starts or ends with punctuation
    (verified: with \b, "user(1)" matched zero times in "call me at
    user(1) now", since both ")" and the following space are non-word
    characters - no transition exists there for \b to find).
    """
    if not banned_words:
        return []

    matches = []
    for word in banned_words:
        word = word.strip()
        if not word:
            continue
        pattern = re.compile(r"(?<!\w)" + re.escape(word) + r"(?!\w)", re.IGNORECASE)
        for match in pattern.finditer(text):
            matches.append({
                "type": "banned_word",
                "value": match.group(),
                "start": match.start(),
                "end": match.end(),
                "severity": "high",
                "source": "banned_word_list",
            })
    return matches