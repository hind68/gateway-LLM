def assign_ids(matches: list[dict]) -> list[dict]:
    """
    Numbers each match by type (email_1, email_2, name_1, ...) in the
    order it appears in the text. Sorting by start first matters because
    `matches` arrives as regex results followed by presidio results, which
    isn't reading order - without this, email_1 could end up referring to
    the second email in the text just because presidio happened to report
    the first one.
    """
    ordered = sorted(matches, key=lambda m: m["start"])
    counts = {}
    for match in ordered:
        pii_type = match["type"]
        counts[pii_type] = counts.get(pii_type, 0) + 1
        match["id"] = f"{pii_type}_{counts[pii_type]}"
    return ordered