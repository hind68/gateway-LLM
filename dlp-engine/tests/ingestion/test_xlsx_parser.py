import os
import tempfile

from openpyxl import Workbook

from app.ingestion.xlsx_parser import extract_xlsx_segments


def _write_xlsx(rows: list[list[str]]) -> str:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    wb.save(path)
    return path


def test_known_and_free_text_columns_are_separated():
    path = _write_xlsx([
        ["email", "notes"],
        ["john@company.com", "Sarah Johnson called about the order"],
    ])
    known_text, free_text = extract_xlsx_segments(path)
    os.remove(path)

    assert "john@company.com" in known_text
    assert "Sarah Johnson" not in known_text
    assert "Sarah Johnson" in free_text
    assert "john@company.com" not in free_text

def test_empty_sheet_returns_empty_segments():
    path = _write_xlsx([])
    known_text, free_text = extract_xlsx_segments(path)
    os.remove(path)
    assert known_text == ""
    assert free_text == ""
