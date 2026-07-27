import io
import os
import tempfile
import zipfile

import pytest

from app.ingestion.zip_parser import extract_text_from_zip, ZipSafetyError


def _make_zip(entries: dict[str, bytes]) -> str:
    fd, path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    with zipfile.ZipFile(path, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return path


def test_context_log_injected_for_unsupported_file():
    path = _make_zip({
        "notes.txt": b"Contact john@company.com",
        "video.mp4": b"fake video bytes",
    })
    text = extract_text_from_zip(path)
    os.remove(path)

    assert "john@company.com" in text
    assert "[SYSTEM LOG: Ignored file 'video.mp4' (Unsupported format)]" in text

def test_zip_with_only_unsupported_files_raises_zip_safety_error():
    path = _make_zip({
        "video.mp4": b"fake video bytes",
        "song.mp3": b"fake audio bytes",
    })
    with pytest.raises(ZipSafetyError, match="no supported"):
        extract_text_from_zip(path)
    os.remove(path)

def test_zip_with_at_least_one_valid_document_does_not_raise():
    path = _make_zip({
        "notes.txt": b"hello world",
        "video.mp4": b"fake video bytes",
    })
    text = extract_text_from_zip(path)  # should not raise
    os.remove(path)
    assert "hello world" in text

def test_source_code_file_inside_zip_is_scanned_as_text():
    path = _make_zip({"config.py": b'DB_PASSWORD = "hunter2345"\n'})
    text = extract_text_from_zip(path)
    os.remove(path)
    assert "hunter2345" in text

def test_corrupt_supported_file_is_logged_not_fatal():
    # a .csv entry that's actually garbage bytes - csv.reader is lenient
    # enough this may or may not "fail" depending on content, so use
    # something that reliably breaks a real parser instead: a .docx
    # entry that isn't a real docx/zip-of-xml at all.
    path = _make_zip({
        "notes.txt": b"hello world",
        "broken.docx": b"not actually a docx file",
    })
    text = extract_text_from_zip(path)  # should not raise - one bad entry, not fatal
    os.remove(path)
    assert "hello world" in text
    assert "broken.docx" in text
    assert "Could not be processed" in text

def test_empty_zip_raises_zip_safety_error():
    path = _make_zip({})
    with pytest.raises(ZipSafetyError):
        extract_text_from_zip(path)
    os.remove(path)

def test_high_compression_ratio_entry_is_rejected():
    # A genuinely bomb-like entry: 10MB of a single repeated byte
    # compresses to ~10KB (over 1000x), which should trip the ratio
    # check before any of it is written to disk.
    fd, path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("bomb.txt", b"A" * (10 * 1024 * 1024))

    with pytest.raises(ZipSafetyError, match="compression ratio"):
        extract_text_from_zip(path)
    os.remove(path)
