import csv
import tempfile
import os

from app.ingestion.csv_parser import extract_csv_segments


def _write_csv(rows: list[list[str]]) -> str:
    fd, path = tempfile.mkstemp(suffix=".csv")
    with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    return path


def test_known_and_free_text_columns_are_separated():
    path = _write_csv([
        ["email", "notes"],
        ["john@company.com", "Sarah Johnson called about the order"],
    ])
    known_text, free_text = extract_csv_segments(path)
    os.remove(path)

    assert "john@company.com" in known_text
    assert "Sarah Johnson" not in known_text
    assert "Sarah Johnson" in free_text
    assert "john@company.com" not in free_text

def test_empty_csv_returns_empty_segments():
    path = _write_csv([])
    known_text, free_text = extract_csv_segments(path)
    os.remove(path)
    assert known_text == ""
    assert free_text == ""

def test_header_only_csv_returns_empty_segments():
    path = _write_csv([["email", "notes"]])
    known_text, free_text = extract_csv_segments(path)
    os.remove(path)
    assert known_text == ""
    assert free_text == ""

def test_all_known_columns_leaves_free_text_empty():
    path = _write_csv([["email", "phone"], ["a@b.com", "0612345678"]])
    known_text, free_text = extract_csv_segments(path)
    os.remove(path)
    assert "a@b.com" in known_text
    assert free_text == ""
