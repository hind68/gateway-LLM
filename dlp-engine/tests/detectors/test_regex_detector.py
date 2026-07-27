import json

import pytest

from app.detectors.regex_detector import (
    run_regex_detectors,
    detect_emails,
    detect_phones,
    detect_credit_cards,
    detect_api_keys,
    add_pattern,
)
import app.detectors.regex_detector as regex_detector_module


def test_no_pii():
    assert run_regex_detectors("The weather is nice today.") == []

def test_detects_email():
    text = "Contact me at john@company.com please"
    matches = detect_emails(text)
    assert len(matches) == 1
    assert text[matches[0]["start"]:matches[0]["end"]] == matches[0]["value"]

def test_detects_phone_no_separators():
    text = "Call me at 0612345678 tomorrow"
    matches = detect_phones(text)
    assert len(matches) == 1
    assert matches[0]["value"] == "0612345678"

def test_detects_phone_with_spaces():
    text = "Call me at 05 13 13 13 13 today"
    matches = detect_phones(text)
    assert len(matches) == 1
    assert matches[0]["value"] == "05 13 13 13 13"

def test_detects_phone_international():
    text = "Reach me at +212512121212 anytime"
    matches = detect_phones(text)
    assert len(matches) == 1

def test_detects_valid_credit_card():
    text = "My card is 4532 0151 1283 0366"
    matches = detect_credit_cards(text)
    assert len(matches) == 1
    assert matches[0]["type"] == "credit_card"

def test_rejects_invalid_credit_card():
    text = "My card is 1234 1234 1234 1234"
    assert detect_credit_cards(text) == []

def test_phone_not_falsely_flagged_as_credit_card():
    text = "Call +212512121212 now"
    types = [m["type"] for m in run_regex_detectors(text)]
    assert "credit_card" not in types

def test_detects_openai_style_key():
    text = "Here's my key: sk-test1234567890abcdefghijklmnop"
    matches = detect_api_keys(text)
    assert any(m["value"] == "sk-test1234567890abcdefghijklmnop" for m in matches)

def test_detects_aws_style_key():
    text = "Access key: AKIAIOSFODNN7EXAMPLE"
    matches = detect_api_keys(text)
    assert any(m["value"] == "AKIAIOSFODNN7EXAMPLE" for m in matches)

def test_detects_two_keys_in_one_text():
    text = "Keys: sk-test1234567890abcdefghijklmnop and AKIAIOSFODNN7EXAMPLE"
    values = [m["value"] for m in detect_api_keys(text)]
    assert "sk-test1234567890abcdefghijklmnop" in values
    assert "AKIAIOSFODNN7EXAMPLE" in values

def test_generic_pattern_ignores_lowercase_hex_hash():
    # A 32-char lowercase-only string (e.g. an MD5 digest) is exactly the
    # kind of false positive the generic \b[A-Za-z0-9]{32,}\b pattern used
    # to wave through as a "high severity" api_key.
    text = "checksum: 5d41402abc4b2a76b9719d911017c592"
    assert detect_api_keys(text) == []

def test_generic_pattern_ignores_pure_numeric_id():
    text = "order id: 12345678901234567890123456789012"
    assert detect_api_keys(text) == []

def test_generic_pattern_still_detects_mixed_case_secret():
    text = "token: aB3dEfGhIjKlMnOpQrStUvWxYz012345"
    matches = detect_api_keys(text)
    assert any(m["value"] == "aB3dEfGhIjKlMnOpQrStUvWxYz012345" for m in matches)


# --- New patterns inspired by cin_morocco.json / rib_schema.json ---

def test_detects_cin_number():
    # cin_number_labeled requires a nearby CIN-style label to match at
    # all (see its "notes" in patterns.json) - unlike the bare-shape
    # pattern this replaced, a CIN number with no label nearby won't be
    # caught, so the label needs to actually be in the test text.
    text = "Ma carte CIN: BE929657 est valide."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "cin_number"]
    assert any(m["value"] == "BE929657" for m in matches)

def test_detects_civil_registry_number():
    text = "N d'etat civil 2003/137 figure au dos de la carte."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "civil_registry_number"]
    assert any(m["value"] == "2003/137" for m in matches)

def test_detects_date_of_birth_as_low_severity():
    text = "Ne le 28.05.2003 a Casablanca."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "date_of_birth"]
    assert any(m["value"] == "28.05.2003" for m in matches)
    assert all(m["severity"] == "low" for m in matches)

def test_detects_full_rib():
    text = "Voici le RIB complet: 230 810 5695021211005700 59 merci."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bank_account"]
    assert any(m["value"] == "230 810 5695021211005700 59" for m in matches)

def test_detects_valid_morocco_iban():
    text = "IBAN: MA64 2307 8094 3410 6211 0034 0090 pour le virement."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "iban"]
    assert any(m["value"] == "MA64 2307 8094 3410 6211 0034 0090" for m in matches)

def test_rejects_invalid_checksum_iban_lookalike():
    # Shape-valid (MA + 2 digits + 24 more), but fails the MOD-97 check -
    # the iban_checksum validator should filter this out.
    text = "IBAN: MA12 3456 7890 1234 5678 9012 3456 pour le virement."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "iban"]
    assert matches == []

def test_detects_morocco_bic_swift():
    text = "Code BIC/SWIFT: CIHMMAMC pour votre agence."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bic_swift"]
    assert any(m["value"] == "CIHMMAMC" for m in matches)

def test_non_morocco_bic_is_not_matched():
    # bic_swift_morocco is deliberately scoped to Moroccan BICs (country
    # segment == "MA") - a foreign bank's BIC shouldn't match.
    text = "Code BIC/SWIFT: DEUTDEFF for the German account."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bic_swift"]
    assert matches == []


def test_detects_env_style_secret():
    text = 'DB_PASSWORD=hunter2345'
    matches = [m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret"]
    assert any(m["value"] == "DB_PASSWORD=hunter2345" for m in matches)

def test_env_style_secret_ignores_unrelated_assignment():
    text = "DEBUG=true"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret"]
    assert matches == []

def test_env_style_secret_bare_pass_abbreviation_is_a_known_gap():
    # Documented limitation, not a bug: bare "PASS" (vs "PASSWORD"/
    # "PASSWD"/"PWD") isn't in the keyword list because it's a substring
    # of too many unrelated identifiers (bypass_check, compass_reading).
    text = "export DB_PASS=hunter2345"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret"]
    assert matches == []


def test_detects_bitcoin_legacy_address():
    text = "Send BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa please"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "crypto_wallet"]
    assert any(m["value"] == "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" for m in matches)

def test_detects_bitcoin_bech32_address():
    text = "Address: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq for the payment"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "crypto_wallet"]
    assert any(m["value"] == "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" for m in matches)

def test_detects_ethereum_address():
    text = "Send tokens to 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984 now"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "crypto_wallet"]
    assert any(m["value"] == "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" for m in matches)

def test_ethereum_pattern_requires_exactly_40_hex_chars():
    # 39 chars (one short) should not match - this is exactly the typo
    # I caught in my own test fixture while building this pattern.
    text = "Not quite valid: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "crypto_wallet"]
    assert matches == []


# --- add_pattern ---

@pytest.fixture
def isolated_rules():
    """Snapshots and restores the module-level rule list so add_pattern
    calls in a test don't leak into other tests."""
    original = list(regex_detector_module._rules)
    yield
    regex_detector_module._rules[:] = original

def test_add_pattern_persists_to_file_and_activates_immediately(tmp_path, isolated_rules):
    patterns_file = tmp_path / "patterns.json"
    patterns_file.write_text('{"patterns": []}', encoding="utf-8")

    add_pattern(
        name="test_ssn",
        pii_type="ssn",
        pattern=r"\b\d{3}-\d{2}-\d{4}\b",
        severity="high",
        path=patterns_file,
    )

    # Persisted to disk...
    saved = json.loads(patterns_file.read_text(encoding="utf-8"))
    assert any(p["name"] == "test_ssn" for p in saved["patterns"])

    # ...and immediately usable without a restart.
    matches = [m for m in run_regex_detectors("SSN: 123-45-6789") if m["type"] == "ssn"]
    assert any(m["value"] == "123-45-6789" for m in matches)

def test_add_pattern_rejects_duplicate_name(tmp_path, isolated_rules):
    patterns_file = tmp_path / "patterns.json"
    patterns_file.write_text('{"patterns": []}', encoding="utf-8")
    add_pattern(name="dup", pii_type="x", pattern=r"\d+", path=patterns_file)
    with pytest.raises(ValueError, match="already exists"):
        add_pattern(name="dup", pii_type="x", pattern=r"\d+", path=patterns_file)

def test_add_pattern_rejects_invalid_regex(tmp_path, isolated_rules):
    patterns_file = tmp_path / "patterns.json"
    patterns_file.write_text('{"patterns": []}', encoding="utf-8")
    with pytest.raises(ValueError, match="not a valid regex"):
        add_pattern(name="bad", pii_type="x", pattern=r"[unclosed", path=patterns_file)

def test_add_pattern_rejects_unknown_validator(tmp_path, isolated_rules):
    patterns_file = tmp_path / "patterns.json"
    patterns_file.write_text('{"patterns": []}', encoding="utf-8")
    with pytest.raises(ValueError, match="Unknown validator"):
        add_pattern(name="bad", pii_type="x", pattern=r"\d+", validator="nonexistent", path=patterns_file)

def test_add_pattern_rejects_invalid_severity(tmp_path, isolated_rules):
    patterns_file = tmp_path / "patterns.json"
    patterns_file.write_text('{"patterns": []}', encoding="utf-8")
    with pytest.raises(ValueError, match="severity"):
        add_pattern(name="bad", pii_type="x", pattern=r"\d+", severity="critical", path=patterns_file)

def test_add_pattern_works_when_file_does_not_exist_yet(tmp_path, isolated_rules):
    patterns_file = tmp_path / "does_not_exist_yet.json"
    add_pattern(name="fresh", pii_type="x", pattern=r"\d+", path=patterns_file)
    assert patterns_file.exists()
    saved = json.loads(patterns_file.read_text(encoding="utf-8"))
    assert saved["patterns"][0]["name"] == "fresh"