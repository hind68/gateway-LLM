import csv

from app.ingestion.structured_routing import classify_columns


def extract_text_from_csv(path: str) -> str:
    parts = []
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.reader(f):
            if row:
                parts.append(", ".join(row))
    return "\n".join(parts)


def extract_csv_segments(path: str) -> tuple[str, str]:
    """
    Like extract_text_from_csv, but splits cells into (known_text,
    free_text) by column header - see structured_routing.py. Falls back
    to routing everything as free text if the file has no header row to
    classify by (empty file).
    """
    known_rows, free_rows = [], []

    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            return "", ""

        column_is_known = classify_columns(headers)

        for row in reader:
            known_cells = [c for i, c in enumerate(row) if c and i < len(column_is_known) and column_is_known[i]]
            free_cells = [c for i, c in enumerate(row) if c and (i >= len(column_is_known) or not column_is_known[i])]
            if known_cells:
                known_rows.append(", ".join(known_cells))
            if free_cells:
                free_rows.append(", ".join(free_cells))

    return "\n".join(known_rows), "\n".join(free_rows)
