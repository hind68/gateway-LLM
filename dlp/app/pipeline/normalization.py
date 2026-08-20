"""Scanning normalization with an exact normalized-to-original offset map."""

from dataclasses import dataclass
import re
import unicodedata


_REPLACEMENTS = {
    "\u00a0": " ", "\u2007": " ", "\u202f": " ",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
}
_REMOVED = {"\u200b", "\u200c", "\u200d", "\ufeff", "\u2060"}


@dataclass(frozen=True)
class NormalizedText:
    text: str
    # Each normalized character maps to a half-open original character span.
    spans: tuple[tuple[int, int], ...]

    def original_span(self, start: int, end: int) -> tuple[int, int]:
        if start < 0 or end <= start or end > len(self.spans):
            raise ValueError("invalid normalized span")
        return self.spans[start][0], self.spans[end - 1][1]


def normalize_for_scanning(text: str) -> NormalizedText:
    output: list[str] = []
    spans: list[tuple[int, int]] = []
    for index, char in enumerate(text):
        if char in _REMOVED:
            continue
        replacement = _REPLACEMENTS.get(char, char)
        # NFKC is intentionally per code point so expansions retain a precise map.
        replacement = unicodedata.normalize("NFKC", replacement)
        for normalized_char in replacement:
            # Arabic-Indic and other Unicode decimal digits become ASCII for
            # format validators while retaining their original spans.
            if normalized_char.isdecimal() and not normalized_char.isascii():
                normalized_char = str(unicodedata.digit(normalized_char))
            output.append(normalized_char)
            spans.append((index, index + 1))
    # Compact common email obfuscation while retaining every original span.
    # Restrict dot compaction to a local window containing '@' so ordinary
    # punctuation is not silently rewritten.
    changed = True
    while changed:
        changed = False
        current = "".join(output)
        for match in list(re.finditer(r"\s+", current)):
            left = current[match.start() - 1] if match.start() else ""
            right = current[match.end()] if match.end() < len(current) else ""
            near_at = "@" in current[max(0, match.start() - 80):min(len(current), match.end() + 80)]
            if ((left.isalnum() and right == "@") or (left == "@" and right.isalnum())
                    or (near_at and ((left.isalnum() and right == ".")
                                     or (left == "." and (right.islower() or right.isdigit()))))):
                del output[match.start():match.end()]
                del spans[match.start():match.end()]
                changed = True
                break
    return NormalizedText("".join(output), tuple(spans))
