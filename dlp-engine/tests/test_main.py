import pytest

pytest.importorskip("transformers")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


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

def test_analyse_mixed_content_full_pipeline():
    text = (
        "Hi, my name is Sarah Johnson and I work at a company based in Boston. "
        "You can reach me by email at sarah.johnson@company.com or by phone at "
        "0612345678."
    )
    response = client.post("/analyse", json={"text": text})
    data = response.json()
    assert data["flagged"] is True

    types_found = {m["type"] for m in data["matches"]}
    assert "name" in types_found
    assert "address" in types_found
    assert "email" in types_found
    assert "phone" in types_found

    # regex should win over presidio's native email/phone detection
    email_matches = [m for m in data["matches"] if m["type"] == "email"]
    assert len(email_matches) == 1
    assert email_matches[0]["source"] == "regex"

    # every match should have a unique id
    ids = [m["id"] for m in data["matches"]]
    assert len(ids) == len(set(ids))
def test_analyse_french_text():
    text = "Bonjour, je m'appelle Karim Ouazzani et j'habite à Casablanca."
    response = client.post("/analyse", json={"text": text})
    data = response.json()
    assert data["flagged"] is True

    types_found = {m["type"] for m in data["matches"]}
    assert "name" in types_found
    assert "address" in types_found

    name_match = next(m for m in data["matches"] if m["type"] == "name")
    assert name_match["source"] == "presidio"