"""
test_main.py exercises the full FastAPI app end-to-end against the *real*
multilingual NER model - the right check, but only runnable where that
multi-gigabyte stack is installed.

This file runs the same app, through the same FastAPI TestClient, over
the same HTTP routes, with the same Match/AnalyseResponse schema
validation - the only difference is the NLP pipeline is swapped for a
lightweight fake that reproduces known entities for known inputs (see
presidio_detector.py: its transformers import is deferred into the lazy
_get_pipeline accessor this file monkeypatches, so no model download or
even package install is needed here). That means it still catches real
integration bugs (wrong route, broken request/response schema,
dedup/alerting/masking wiring) in milliseconds.
"""
import io
import zipfile

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.detectors import presidio_detector as pd

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_pii_by_default(monkeypatch):
    # Default: the NER pipeline finds nothing. Individual tests override
    # this to inject specific fake entities. Returns a plain callable
    # simulating the real batched interface: takes a list of chunk
    # texts, returns one prediction-list per chunk (here, always empty).
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk_texts: [[] for _ in chunk_texts]))


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyse_no_pii():
    response = client.post("/analyse", json={"text": "The weather is nice today."})
    data = response.json()
    assert data["flagged"] is False
    assert data["matches"] == []
    assert data["masked_text"] == "The weather is nice today."


def test_analyse_with_email():
    response = client.post("/analyse", json={"text": "Contact john@company.com please"})
    data = response.json()
    assert data["flagged"] is True
    assert any(m["type"] == "email" for m in data["matches"])
    assert "[EMAIL_1_REDACTED]" in data["masked_text"]


def test_analyse_mixed_content_full_pipeline(monkeypatch):
    text = (
        "Hi, my name is Sarah Johnson and I work at a company based in Boston. "
        "You can reach me by email at sarah.johnson@company.com or by phone at "
        "0612345678."
    )
    fake_predictions = [
        {"entity_group": "PER", "start": 15, "end": 28, "score": 0.9},
        {"entity_group": "LOC", "start": 62, "end": 68, "score": 0.85},
    ]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    response = client.post("/analyse", json={"text": text})
    data = response.json()
    assert data["flagged"] is True

    types_found = {m["type"] for m in data["matches"]}
    assert "name" in types_found
    assert "address" in types_found
    assert "email" in types_found
    assert "phone" in types_found

    email_matches = [m for m in data["matches"] if m["type"] == "email"]
    assert len(email_matches) == 1
    assert email_matches[0]["source"] == "regex"

    ids = [m["id"] for m in data["matches"]]
    assert len(ids) == len(set(ids))


def test_analyse_french_text(monkeypatch):
    text = "Bonjour, je m'appelle Karim Ouazzani et j'habite à Casablanca."
    fake_predictions = [
        {"entity_group": "PER", "start": 22, "end": 36, "score": 0.95},
        {"entity_group": "LOC", "start": 51, "end": 61, "score": 0.9},
    ]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    response = client.post("/analyse", json={"text": text})
    data = response.json()
    assert data["flagged"] is True

    types_found = {m["type"] for m in data["matches"]}
    assert "name" in types_found
    assert "address" in types_found

    name_match = next(m for m in data["matches"] if m["type"] == "name")
    assert name_match["source"] == "presidio"


def test_analyse_morocco_cin_and_bank_details():
    # Purely regex-driven - labeled patterns need the label present.
    text = (
        "Ma carte CIN: BE929657. "
        "Voici mon IBAN: MA64 2307 8094 3410 6211 0034 0090 "
        "et le RIB complet 230 810 5695021211005700 59."
    )
    response = client.post("/analyse", json={"text": text})
    data = response.json()
    assert data["flagged"] is True

    types_found = {m["type"] for m in data["matches"]}
    assert "cin_number" in types_found
    assert "iban" in types_found
    assert "bank_account" in types_found


def test_analyse_text_too_long_returns_413():
    from app.main import MAX_TEXT_LENGTH
    response = client.post("/analyse", json={"text": "a" * (MAX_TEXT_LENGTH + 1)})
    assert response.status_code == 413


def test_analyse_image_rejects_non_image_upload():
    files = {"file": ("not_an_image.txt", io.BytesIO(b"just some plain bytes"), "text/plain")}
    response = client.post("/analyse-image", files=files)
    assert response.status_code == 400


def test_analyse_pdf_rejects_non_pdf_upload():
    files = {"file": ("not_a.pdf", io.BytesIO(b"not actually a pdf"), "application/pdf")}
    response = client.post("/analyse-pdf", files=files)
    assert response.status_code == 400


# --- requirement group 1: gateway security & edge cases ---

def test_analyse_file_rejects_unsupported_extension_instantly():
    # A "video" upload should be rejected on the filename alone - this
    # implicitly checks the extension check runs before any attempt to
    # parse content, since this "video" is actually just plain garbage
    # bytes that would fail to parse as anything anyway.
    files = {"file": ("clip.mp4", io.BytesIO(b"not a real video, just bytes"), "video/mp4")}
    response = client.post("/analyse-file", files=files)
    assert response.status_code == 400
    assert "mp4" in response.json()["detail"].lower()


def test_analyse_file_rejects_zip_with_only_unsupported_content():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("movie.mp4", b"fake video bytes" * 100)
        zf.writestr("song.mp3", b"fake audio bytes" * 100)
    buf.seek(0)

    files = {"file": ("archive.zip", buf, "application/zip")}
    response = client.post("/analyse-file", files=files)
    assert response.status_code == 400
    assert "no supported" in response.json()["detail"].lower()


def test_analyse_file_zip_with_mixed_content_still_works():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("notes.txt", "Contact me at john@company.com")
        zf.writestr("video.mp4", b"fake video bytes")
    buf.seek(0)

    files = {"file": ("archive.zip", buf, "application/zip")}
    response = client.post("/analyse-file", files=files)
    assert response.status_code == 200
    data = response.json()
    assert any(m["type"] == "email" for m in data["matches"])
    # the skipped video should be visible in the extracted text somewhere
    # (via masked_text, since it's part of what got analysed) - not
    # silently vanished with no trace at all
    assert "video.mp4" in data["masked_text"]


# --- requirement group 2: developer workflows & allowlisting ---

def test_analyse_file_scans_python_source_for_hardcoded_secret():
    code = 'DB_PASSWORD = "hunter2345"\ndef connect():\n    pass\n'
    files = {"file": ("config.py", io.BytesIO(code.encode()), "text/x-python")}
    response = client.post("/analyse-file", files=files)
    assert response.status_code == 200
    data = response.json()
    assert any(m["type"] == "hardcoded_secret" for m in data["matches"])


# --- requirement group 3: structured data routing ---

def test_analyse_file_csv_routes_known_columns_to_regex_only(monkeypatch):
    calls = []

    def fake_pipeline(chunk_texts):
        # batched interface: receives the list of all chunks at once,
        # returns one prediction-list per chunk, same order
        calls.extend(chunk_texts)
        return [
            [{"entity_group": "PER", "start": 0, "end": min(5, len(c)), "score": 0.99}]
            for c in chunk_texts
        ]

    monkeypatch.setattr(pd, "_get_pipeline", lambda: fake_pipeline)

    csv_content = "email,notes\njohn@company.com,Sarah Johnson mentioned in passing\n"
    files = {"file": ("contacts.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    response = client.post("/analyse-file", files=files)
    assert response.status_code == 200
    data = response.json()

    # regex still catches the known (email) column on its own
    assert any(m["type"] == "email" for m in data["matches"])

    # the NER pipeline should never see the known column's raw content -
    # only the free-text column should ever reach it
    assert not any("company.com" in c for c in calls)
    assert any("Sarah Johnson" in c for c in calls)


# --- MaxBodySizeMiddleware ---

def test_oversized_content_length_is_rejected_without_reading_body():
    from app.main import MAX_UPLOAD_BYTES
    # A spoofed Content-Length header lets this test verify the rejection
    # happens on the header alone, without actually sending 200MB+ of data.
    response = client.post(
        "/analyse",
        json={"text": "hello"},
        headers={"content-length": str(MAX_UPLOAD_BYTES + 1)},
    )
    assert response.status_code == 413

def test_normal_sized_request_is_not_affected_by_the_middleware():
    response = client.post("/analyse", json={"text": "hello"})
    assert response.status_code == 200


# --- /analyse-message: the real unified text + attachments endpoint ---

def test_analyse_message_requires_text_or_files():
    response = client.post("/analyse-message")
    assert response.status_code == 400

def test_analyse_message_text_only():
    response = client.post("/analyse-message", data={"text": "Contact john@company.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["flagged"] is True
    assert len(data["results"]) == 1
    assert data["results"][0]["source"] == "message"
    assert any(m["type"] == "email" for m in data["results"][0]["matches"])

def test_analyse_message_text_plus_file_tagged_by_source():
    files = {"file": ("notes.txt", io.BytesIO(b"IBAN MA64 2307 8094 3410 6211 0034 0090"), "text/plain")}
    response = client.post(
        "/analyse-message",
        data={"text": "Contact john@company.com"},
        files=[("files", files["file"])],
    )
    assert response.status_code == 200
    data = response.json()
    assert data["flagged"] is True
    sources = {r["source"]: r for r in data["results"]}
    assert "message" in sources
    assert "notes.txt" in sources
    assert any(m["type"] == "email" for m in sources["message"]["matches"])
    assert any(m["type"] == "iban" for m in sources["notes.txt"]["matches"])

def test_analyse_message_multiple_files_no_text():
    files = [
        ("files", ("a.txt", io.BytesIO(b"a@company.com"), "text/plain")),
        ("files", ("b.txt", io.BytesIO(b"CIN: BE929657"), "text/plain")),
    ]
    response = client.post("/analyse-message", files=files)
    assert response.status_code == 200
    data = response.json()
    sources = {r["source"] for r in data["results"]}
    assert sources == {"a.txt", "b.txt"}

def test_analyse_message_unsupported_file_does_not_block_others():
    files = [
        ("files", ("notes.txt", io.BytesIO(b"Contact a@company.com"), "text/plain")),
        ("files", ("clip.mp4", io.BytesIO(b"fake video bytes"), "video/mp4")),
    ]
    response = client.post("/analyse-message", files=files)
    assert response.status_code == 200
    data = response.json()
    sources = {r["source"]: r for r in data["results"]}

    assert any(m["type"] == "email" for m in sources["notes.txt"]["matches"])
    assert sources["clip.mp4"]["flagged"] is False
    assert "unsupported" in sources["clip.mp4"]["masked_text"].lower()

def test_analyse_message_csv_attachment_still_gets_two_tier_routing(monkeypatch):
    calls = []

    def fake_pipeline(chunk_texts):
        calls.extend(chunk_texts)
        return [[] for _ in chunk_texts]

    monkeypatch.setattr(pd, "_get_pipeline", lambda: fake_pipeline)

    csv_content = "email,notes\njohn@company.com,Sarah Johnson called\n"
    files = {"files": ("contacts.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    response = client.post("/analyse-message", files=files)
    assert response.status_code == 200

    assert not any("company.com" in c for c in calls)
    assert any("Sarah Johnson" in c for c in calls)
