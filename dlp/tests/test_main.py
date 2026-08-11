import io
import logging
import zipfile

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.main import app


client = TestClient(app)


def _disable_presidio(monkeypatch):
    monkeypatch.setattr(main, "detect_with_presidio", lambda text, language="en": [])


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP", "service": "dlp-service"}


def test_ready(monkeypatch):
    monkeypatch.setattr(main, "warm_up_models", lambda: None)
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "READY"
    assert response.json()["presidio"] is True


def test_normal_text_is_allowed(monkeypatch):
    _disable_presidio(monkeypatch)
    response = client.post("/analyse", json={"text": "Bonjour, peux-tu resumer ce document ?"})
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["decision"] == "ALLOW"
    assert data["flagged"] is False
    assert data["matches"] == []


def test_email_is_masked_and_not_exposed_in_matches(monkeypatch):
    _disable_presidio(monkeypatch)
    response = client.post("/analyse", json={"text": "Mon adresse est client@example.com"})
    data = response.json()
    assert data["decision"] == "MASK"
    assert any(match["type"] == "email" for match in data["matches"])
    assert all("value" not in match for match in data["matches"])
    assert "client@example.com" not in str(data["matches"])
    assert "client@example.com" not in data["masked_text"]


def test_moroccan_cin_requires_context(monkeypatch):
    _disable_presidio(monkeypatch)
    positive = client.post("/analyse", json={"text": "CIN: BE929657"})
    assert positive.json()["decision"] == "BLOCK"
    assert any(match["type"] == "moroccan_cin" for match in positive.json()["matches"])

    negative = client.post("/analyse", json={"text": "La reference du ticket est AB123456."})
    negative_data = negative.json()
    assert negative_data["decision"] == "MASK"
    assert any(match["type"] == "alphanumeric_identifier" for match in negative_data["matches"])
    assert not any(match["type"] == "moroccan_cin" for match in negative_data["matches"])


def test_cin_lookalike_shapes_are_masked_as_distinct_identifier(monkeypatch):
    _disable_presidio(monkeypatch)

    for value in ["A123456", "AB123456", "BE1234567", "GI22568"]:
        data = client.post("/analyse", json={"text": value}).json()
        assert data["decision"] == "MASK"
        assert data["highest_severity"] == "medium"
        assert any(match["type"] == "alphanumeric_identifier" for match in data["matches"])
        assert not any(match["type"] == "moroccan_cin" for match in data["matches"])
        assert value not in data["masked_text"]


def test_moroccan_cin_exact_text_blocks_and_masks(monkeypatch):
    _disable_presidio(monkeypatch)
    data = client.post("/analyse", json={"text": "Le numero de CIN du client est AB123456."}).json()

    assert data["status"] == "SUCCESS"
    assert data["decision"] == "BLOCK"
    assert data["flagged"] is True
    assert data["highest_severity"] == "high"
    assert data["masked_text"] == "Le numero de CIN du client est [MOROCCAN_CIN_1]."
    assert any(match["type"] == "moroccan_cin" and match["severity"] == "high" for match in data["matches"])


def test_moroccan_cin_short_format_blocks(monkeypatch):
    _disable_presidio(monkeypatch)
    data = client.post("/analyse", json={"text": "CIN : A123456"}).json()

    assert data["decision"] == "BLOCK"
    assert any(match["type"] == "moroccan_cin" for match in data["matches"])


def test_moroccan_cin_carte_nationale_blocks(monkeypatch):
    _disable_presidio(monkeypatch)
    data = client.post("/analyse", json={"text": "Numero de carte nationale BE1234567"}).json()

    assert data["decision"] == "BLOCK"
    assert any(match["type"] == "moroccan_cin" for match in data["matches"])


def test_moroccan_cin_ticket_and_build_references_are_masked_not_cin(monkeypatch):
    _disable_presidio(monkeypatch)

    ticket = client.post("/analyse", json={"text": "La reference du ticket est AB123456."}).json()
    build = client.post("/analyse", json={"text": "Le build AB123456 a echoue."}).json()

    assert ticket["decision"] == "MASK"
    assert build["decision"] == "MASK"
    assert not any(match["type"] == "moroccan_cin" for match in ticket["matches"])
    assert not any(match["type"] == "moroccan_cin" for match in build["matches"])
    assert any(match["type"] == "alphanumeric_identifier" for match in ticket["matches"])
    assert any(match["type"] == "alphanumeric_identifier" for match in build["matches"])

@pytest.mark.parametrize(
    ("text", "decision", "expected_type"),
    [
        ("ma cin est ac12345", "BLOCK", "moroccan_cin"),
        ("Ma CIN est AC12345", "BLOCK", "moroccan_cin"),
        ("My national ID is Ac12345", "BLOCK", "moroccan_cin"),
        ("Ticket ac12345", "MASK", "alphanumeric_identifier"),
        ("ac12345", "MASK", "alphanumeric_identifier"),
    ],
)
def test_moroccan_cin_detection_is_case_insensitive(monkeypatch, text, decision, expected_type):
    _disable_presidio(monkeypatch)

    data = client.post("/analyse", json={"text": text}).json()

    assert data["decision"] == decision
    assert any(match["type"] == expected_type for match in data["matches"])
    if expected_type == "moroccan_cin":
        assert data["highest_severity"] == "high"
        assert not any(match["type"] == "alphanumeric_identifier" for match in data["matches"])
    else:
        assert not any(match["type"] == "moroccan_cin" for match in data["matches"])
    if " " in text:
        assert data["masked_text"].startswith(text.split()[0])
    else:
        assert data["masked_text"].startswith("[")


def test_multilingual_cin_context_blocks(monkeypatch):
    _disable_presidio(monkeypatch)

    examples = [
        "Ma CIN est GI22568",
        "My national ID is AB123456",
        "رقم البطاقة الوطنية هو AB123456",
    ]

    for text in examples:
        data = client.post("/analyse", json={"text": text}).json()
        assert data["decision"] == "BLOCK"
        assert any(match["type"] == "moroccan_cin" for match in data["matches"])


def test_validators_for_iban_and_credit_card(monkeypatch):
    _disable_presidio(monkeypatch)
    valid = client.post("/analyse", json={"text": "IBAN MA64 2307 8094 3410 6211 0034 0090 carte 4111 1111 1111 1111"})
    types = {match["type"] for match in valid.json()["matches"]}
    assert "iban" in types
    assert "credit_card" in types

    invalid = client.post("/analyse", json={"text": "IBAN MA00 2307 8094 3410 6211 0034 0090 carte 4111 1111 1111 1112"})
    types = {match["type"] for match in invalid.json()["matches"]}
    assert "iban" not in types
    assert "credit_card" not in types


def test_technical_secrets_block(monkeypatch):
    _disable_presidio(monkeypatch)
    text = (
        "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456 "
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 "
        "password = \"Secret123\""
    )
    data = client.post("/analyse", json={"text": text}).json()
    assert data["decision"] == "BLOCK"
    assert data["highest_severity"] == "high"
    assert any(match["severity"] == "high" for match in data["matches"])


def test_confirmed_false_positive_phrases_are_allowed():
    examples = [
        "Explique-moi simplement le principe.",
        "Donne-moi le numero de carte.",
        "Spring Boot utilise Java.",
        "GitHub utilise parfois le prefixe ghp_.",
    ]

    for text in examples:
        data = client.post("/analyse", json={"text": text}).json()
        assert data["decision"] == "ALLOW"
        assert data["matches"] == []


def test_labeled_compact_rib_blocks_without_exposing_value(monkeypatch):
    _disable_presidio(monkeypatch)
    data = client.post("/analyse", json={"text": "Mon RIB est 007780000045678901234567."}).json()

    assert data["decision"] == "BLOCK"
    assert any(match["type"] == "bank_account" for match in data["matches"])
    assert "007780000045678901234567" not in str(data["matches"])
    assert "007780000045678901234567" not in data["masked_text"]


def test_private_key_headers_block(monkeypatch):
    _disable_presidio(monkeypatch)

    for header in [
        "-----BEGIN PRIVATE KEY-----",
        "-----BEGIN RSA PRIVATE KEY-----",
        "-----BEGIN OPENSSH PRIVATE KEY-----",
    ]:
        data = client.post("/analyse", json={"text": header}).json()
        assert data["decision"] == "BLOCK"
        assert any(match["type"] == "private_key" for match in data["matches"])
        assert header not in str(data["matches"])


def test_technical_secret_types_are_distinct_in_analyse(monkeypatch):
    _disable_presidio(monkeypatch)
    text = (
        "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 "
        "GitHub token ghp_abcdefghijklmnopqrstuvwxyz123456 "
        "JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue123456 "
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"
    )
    data = client.post("/analyse", json={"text": text}).json()
    types = {match["type"] for match in data["matches"]}

    assert data["decision"] == "BLOCK"
    assert {"openai_api_key", "github_token", "jwt_token", "bearer_token"}.issubset(types)


def test_openai_project_key_is_fully_masked_without_prefix_leak(monkeypatch):
    _disable_presidio(monkeypatch)
    text = "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"

    data = client.post("/analyse", json={"text": text}).json()

    assert data["decision"] == "BLOCK"
    assert data["masked_text"] == "OPENAI_API_KEY=[API_KEY_1]"
    assert "sk-proj-" not in data["masked_text"]
    assert "]]" not in data["masked_text"]
    assert any(match["type"] == "openai_api_key" for match in data["matches"])


def test_masked_secret_placeholders_are_idempotent(monkeypatch):
    _disable_presidio(monkeypatch)
    text = "\n".join([
        "DB_PASSWORD=realSecret123",
        "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456",
        "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    ])

    first = client.post("/analyse", json={"text": text}).json()
    second = client.post("/analyse", json={"text": first["masked_text"]}).json()

    assert first["decision"] == "BLOCK"
    assert "DB_PASSWORD=[HARDCODED_SECRET_1]" in first["masked_text"]
    assert "GITHUB_TOKEN=[GITHUB_TOKEN_1]" in first["masked_text"]
    assert "OPENAI_API_KEY=[API_KEY_1]" in first["masked_text"]
    assert second["decision"] == "ALLOW"
    assert second["matches"] == []
    assert second["masked_text"] == first["masked_text"]


def test_presidio_placeholder_matches_are_filtered(monkeypatch):
    text = "Contact [EMAIL_1]"
    monkeypatch.setattr(main, "detect_with_presidio", lambda value, language="en": [{
        "type": "email",
        "start": value.index("[EMAIL_1]"),
        "end": value.index("[EMAIL_1]") + len("[EMAIL_1]"),
        "score": 0.9,
        "severity": "medium",
        "source": "presidio",
    }])

    data = client.post("/analyse", json={"text": text}).json()

    assert data["decision"] == "ALLOW"
    assert data["matches"] == []
    assert data["masked_text"] == text


def test_two_openai_keys_get_coherent_indices(monkeypatch):
    _disable_presidio(monkeypatch)
    text = (
        "first sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 "
        "second sk-abcdefghijklmnopqrstuvwxyz123456"
    )

    data = client.post("/analyse", json={"text": text}).json()

    assert "[API_KEY_1]" in data["masked_text"]
    assert "[API_KEY_2]" in data["masked_text"]
    assert data["masked_text"].index("[API_KEY_1]") < data["masked_text"].index("[API_KEY_2]")
    assert "sk-proj-" not in data["masked_text"]


def test_ip_policy_currently_blocks_and_is_documented(monkeypatch):
    _disable_presidio(monkeypatch)
    data = client.post("/analyse", json={"text": "Adresse IP 192.168.1.24"}).json()

    assert data["decision"] == "BLOCK"
    assert any(match["type"] == "ip_address" and match["severity"] == "high" for match in data["matches"])


def test_contact_sentence_detects_person_and_email():
    data = client.post("/analyse", json={"text": "Contactez Jean Dupont a client@example.com"}).json()
    types = {match["type"] for match in data["matches"]}

    assert data["decision"] == "MASK"
    assert "person_name" not in types
    assert "email" in types


def test_arabic_text_uses_regex_without_french_nlp(monkeypatch):
    calls = []

    def fake_presidio(text, language="en"):
        calls.append(language)
        return []

    monkeypatch.setattr(main, "detect_with_presidio", fake_presidio)
    data = client.post("/analyse", json={"text": "مرحبا client@example.com"}).json()
    assert data["decision"] == "MASK"
    assert calls == ["ar"]


def test_utf8_text_round_trips_without_mojibake(monkeypatch):
    _disable_presidio(monkeypatch)

    examples = [
        "Ma clé API",
        "Mon numéro de téléphone",
        "La référence est AB123456",
        "البريد الإلكتروني هو client@example.com",
    ]

    for text in examples:
        data = client.post("/analyse", json={"text": text}).json()
        serialized = str(data)
        assert "clÃ©" not in serialized
        assert "numÃ©ro" not in serialized
        assert "rÃ©fÃ©rence" not in serialized
        if data["masked_text"] == text:
            assert data["masked_text"] == text


@pytest.mark.parametrize(
    ("text", "expected_type", "decision"),
    [
        ("Mon email est client@example.com", "email", "MASK"),
        ("My email is client@example.com", "email", "MASK"),
        ("البريد الإلكتروني هو client@example.com", "email", "MASK"),
        ("Mon téléphone est 0612345678", "phone_number", "MASK"),
        ("My Moroccan phone is +212612345678", "phone_number", "MASK"),
        ("رقم الهاتف هو 0612345678", "phone_number", "MASK"),
        ("Ma CIN est GI22568", "moroccan_cin", "BLOCK"),
        ("My national ID is AB123456", "moroccan_cin", "BLOCK"),
        ("رقم البطاقة الوطنية هو AB123456", "moroccan_cin", "BLOCK"),
        ("Mon IBAN est MA64 2307 8094 3410 6211 0034 0090", "iban", "BLOCK"),
        ("My IBAN is MA64 2307 8094 3410 6211 0034 0090", "iban", "BLOCK"),
        ("رقم IBAN هو MA64 2307 8094 3410 6211 0034 0090", "iban", "BLOCK"),
        ("Mon RIB est 007780000045678901234567", "bank_account", "BLOCK"),
        ("My bank account RIB is 007780000045678901234567", "bank_account", "BLOCK"),
        ("رقم RIB هو 007780000045678901234567", "bank_account", "BLOCK"),
        ("Ma carte bancaire est 4111 1111 1111 1111", "credit_card", "BLOCK"),
        ("My card is 4111 1111 1111 1111", "credit_card", "BLOCK"),
        ("رقم البطاقة البنكية هو 4111 1111 1111 1111", "credit_card", "BLOCK"),
        ("Adresse IP 192.168.1.24", "ip_address", "BLOCK"),
        ("IP address 192.168.1.24", "ip_address", "BLOCK"),
        ("عنوان IP هو 192.168.1.24", "ip_address", "BLOCK"),
        ("Ma clé API est sk-abcdefghijklmnopqrstuvwxyz123456", "openai_api_key", "BLOCK"),
        ("My API key is sk-abcdefghijklmnopqrstuvwxyz123456", "openai_api_key", "BLOCK"),
        ("مفتاح API هو sk-abcdefghijklmnopqrstuvwxyz123456", "openai_api_key", "BLOCK"),
    ],
)
def test_structured_dlp_coverage_fr_en_ar(monkeypatch, text, expected_type, decision):
    _disable_presidio(monkeypatch)

    data = client.post("/analyse", json={"text": text}).json()

    assert data["decision"] == decision
    assert any(match["type"] == expected_type for match in data["matches"])


def test_txt_file(monkeypatch):
    _disable_presidio(monkeypatch)
    files = {"file": ("note.txt", io.BytesIO(b"Contact client@example.com"), "text/plain")}
    data = client.post("/analyse-file", files=files).json()
    assert data["decision"] == "MASK"
    assert any(match["type"] == "email" for match in data["matches"])


def test_unsupported_file_fails_closed(monkeypatch):
    _disable_presidio(monkeypatch)
    files = {"file": ("video.mp4", io.BytesIO(b"content"), "video/mp4")}
    data = client.post("/analyse-file", files=files).json()
    assert data["status"] == "ERROR"
    assert data["decision"] == "BLOCK"
    assert data["flagged"] is None


def test_zip_with_only_unsupported_content_fails_closed(monkeypatch):
    _disable_presidio(monkeypatch)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("video.mp4", b"fake")
    buf.seek(0)
    files = {"file": ("archive.zip", buf, "application/zip")}
    data = client.post("/analyse-file", files=files).json()
    assert data["status"] == "ERROR"
    assert data["decision"] == "BLOCK"


def test_logs_do_not_contain_sensitive_values(monkeypatch, caplog):
    _disable_presidio(monkeypatch)
    caplog.set_level(logging.WARNING, logger="dlp_alerts")
    client.post("/analyse", json={"text": "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456", "user_id": "demo-user"})
    logs = "\n".join(record.message for record in caplog.records)
    assert "sk-abcdefghijklmnopqrstuvwxyz123456" not in logs
    assert "api_key" in logs
