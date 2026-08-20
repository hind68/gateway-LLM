import json

import pytest

from app.detectors.regex_detector import (
    run_regex_detectors,
    detect_emails,
    detect_phones,
    detect_credit_cards,
    detect_api_keys,
    add_pattern,
    _compile_rule,
    _run_rules,
)
import app.detectors.regex_detector as regex_detector_module


def test_no_pii():
    assert run_regex_detectors("The weather is nice today.") == []

def test_disabled_pattern_is_not_run():
    rule = _compile_rule({"name": "disabled", "type": "secret", "pattern": r"SECRET-\d+", "enabled": False})
    assert _run_rules([rule], "SECRET-123") == []

def test_pattern_action_is_attached_to_matches():
    rule = _compile_rule({"name": "blocked", "type": "secret", "pattern": r"SECRET-\d+", "action": "block"})
    matches = _run_rules([rule], "SECRET-123")
    assert matches[0]["action"] == "BLOCK"

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
    assert any(m["type"] == "openai_api_key" and m["value"] == "sk-test1234567890abcdefghijklmnop" for m in matches)

def test_detects_openai_project_key_with_distinct_type():
    text = "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
    matches = run_regex_detectors(text)
    assert any(m["type"] == "openai_api_key" for m in matches)

def test_detects_openai_key_with_url_safe_characters():
    value = "sk-proj-abcd_EFGH-ijkl_MNOP-qrst_1234567890"
    matches = detect_api_keys(f"OPENAI_API_KEY={value}")
    assert any(m["type"] == "openai_api_key" and m["value"] == value for m in matches)

def test_detects_aws_style_key():
    text = "Access key: AKIAIOSFODNN7EXAMPLE"
    matches = detect_api_keys(text)
    assert any(m["value"] == "AKIAIOSFODNN7EXAMPLE" for m in matches)

def test_detects_temporary_aws_style_key():
    value = "ASIAIOSFODNN7EXAMPLE"
    assert any(m["value"] == value for m in detect_api_keys(f"AWS_ACCESS_KEY_ID={value}"))

def test_detects_fine_grained_github_token():
    value = "github_pat_11AAAAAA0_example_token_value_123456"
    matches = detect_api_keys(f"GITHUB_TOKEN={value}")
    assert any(m["type"] == "github_token" and m["value"] == value for m in matches)

def test_detects_padded_bearer_token_to_the_end():
    value = "abcdefghijklmnopqrstuvwxyz123456=="
    matches = detect_api_keys(f"Authorization: Bearer {value}")
    assert any(m["type"] == "bearer_token" and value in m["value"] for m in matches)

def test_detects_two_keys_in_one_text():
    text = "Keys: sk-test1234567890abcdefghijklmnop and AKIAIOSFODNN7EXAMPLE"
    values = [m["value"] for m in detect_api_keys(text)]
    assert "sk-test1234567890abcdefghijklmnop" in values
    assert "AKIAIOSFODNN7EXAMPLE" in values

def test_technical_secret_types_are_distinct():
    text = (
        "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 "
        "GitHub token ghp_abcdefghijklmnopqrstuvwxyz123456 "
        "JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue123456 "
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"
    )
    types = {m["type"] for m in run_regex_detectors(text)}
    assert "openai_api_key" in types
    assert "github_token" in types
    assert "jwt_token" in types
    assert "bearer_token" in types

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

def test_context_restores_hash_shaped_secret():
    value = "5d41402abc4b2a76b9719d911017c592"
    assert any(m["value"] == value for m in detect_api_keys(f"access_token: {value}"))

def test_generic_secret_ignores_environment_references():
    assert run_regex_detectors('password=os.getenv("PASSWORD")') == []
    assert run_regex_detectors("token=process.env.ACCESS_TOKEN") == []
    assert run_regex_detectors('String clientSecret = System.getenv("CLIENT_SECRET");') == []

def test_json_secret_masks_only_literal_value():
    text = '{"password": "abc123XYZ"}'
    match = next(m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret")
    assert match["value"] == "abc123XYZ"

def test_ip_classification_and_contextual_severity():
    cases = [
        ("test 127.0.0.1", "loopback", "low"),
        ("cache 10.1.2.3", "private", "low"),
        ("public 8.8.8.8", "public", "medium"),
        ("production db 10.1.2.3", "private", "medium"),
        ("production server 8.8.8.8", "public", "high"),
    ]
    for text, category, severity in cases:
        match = next(m for m in run_regex_detectors(text) if m["type"] == "ip_address")
        assert (match["ip_category"], match["severity"]) == (category, severity)
        assert "action" not in match


# --- New patterns inspired by cin_morocco.json / rib_schema.json ---

def test_detects_cin_number():
    # cin_number_labeled requires a nearby CIN-style label to match at
    # all (see its "notes" in patterns.json) - unlike the bare-shape
    # pattern this replaced, a CIN number with no label nearby won't be
    # caught, so the label needs to actually be in the test text.
    text = "Ma carte CIN: BE929657 est valide."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert any(m["value"] == "BE929657" for m in matches)

def test_detects_cin_number_with_words_between_label_and_value():
    text = "Le numero de CIN du client est AB123456."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert any(m["value"] == "AB123456" for m in matches)

def test_detects_single_letter_cin_number():
    text = "CIN : A123456"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert any(m["value"] == "A123456" for m in matches)

def test_cin_lookalike_shapes_are_maskable_identifiers_without_context():
    for value in ["A123456", "AB123456", "BE1234567", "GI22568", "ac12345", "Ac12345", "aC12345"]:
        matches = [m for m in run_regex_detectors(value) if m["type"] == "alphanumeric_identifier"]
        assert len(matches) == 1
        assert matches[0]["value"] == value
        assert matches[0]["severity"] == "medium"

def test_cin_detection_preserves_original_case_and_offsets():
    text = "ma cin est ac12345"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert len(matches) == 1
    assert matches[0]["value"] == "ac12345"
    assert text[matches[0]["start"]:matches[0]["end"]] == "ac12345"

def test_detects_carte_nationale_cin_number():
    text = "Numero de carte nationale BE1234567"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert any(m["value"] == "BE1234567" for m in matches)

def test_detects_english_national_id_context_as_cin():
    text = "My national ID is AB123456"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert any(m["value"] == "AB123456" for m in matches)

def test_detects_arabic_card_context_as_cin():
    text = "رقم البطاقة الوطنية هو AB123456"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "moroccan_cin"]
    assert any(m["value"] == "AB123456" for m in matches)

def test_ticket_reference_shape_is_not_cin_without_context():
    text = "La reference du ticket est AB123456."
    matches = run_regex_detectors(text)
    assert not any(m["type"] == "moroccan_cin" for m in matches)
    assert any(m["type"] == "alphanumeric_identifier" for m in matches)

def test_build_reference_shape_is_not_cin_without_context():
    text = "Le build AB123456 a echoue."
    matches = run_regex_detectors(text)
    assert not any(m["type"] == "moroccan_cin" for m in matches)
    assert any(m["type"] == "alphanumeric_identifier" for m in matches)

def test_detects_civil_registry_number():
    text = "N d'etat civil 2003/137 figure au dos de la carte."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "civil_registry_number"]
    assert any(m["value"] == "2003/137" for m in matches)

def test_detects_date_of_birth_as_low_severity():
    text = "Ne le 28.05.2003 a Casablanca."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "date_of_birth"]
    assert any(m["value"] == "28.05.2003" for m in matches)
    assert all(m["severity"] == "low" for m in matches)

def test_detects_hyphenated_date_of_birth():
    text = "Date de naissance: 28-05-2003"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "date_of_birth"]
    assert any(m["value"] == "28-05-2003" for m in matches)

def test_detects_full_rib():
    text = "Voici le RIB complet: 230 810 5695021211005700 59 merci."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bank_account"]
    assert any(m["value"] == "230 810 5695021211005700 59" for m in matches)

def test_detects_labeled_compact_rib_with_expected_length():
    text = "Mon RIB est 007780000045678901234567."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bank_account"]
    assert any(m["value"] == "007780000045678901234567" for m in matches)

def test_compact_rib_requires_context():
    text = "La reference 007780000045678901234567 est technique."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bank_account"]
    assert matches == []

def test_detects_private_key_headers_as_private_key():
    for header in [
        "-----BEGIN PRIVATE KEY-----",
        "-----BEGIN RSA PRIVATE KEY-----",
        "-----BEGIN OPENSSH PRIVATE KEY-----",
    ]:
        matches = [m for m in run_regex_detectors(header) if m["type"] == "private_key"]
        assert matches

def test_detects_valid_morocco_iban():
    text = "IBAN: MA64 2307 8094 3410 6211 0034 0090 pour le virement."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "iban"]
    assert any(m["value"] == "MA64 2307 8094 3410 6211 0034 0090" for m in matches)

def test_detects_lowercase_hyphenated_morocco_iban():
    value = "ma64-2307-8094-3410-6211-0034-0090"
    matches = [m for m in run_regex_detectors(f"IBAN: {value}") if m["type"] == "iban"]
    assert any(m["value"] == value for m in matches)

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

def test_detects_lowercase_morocco_bic_swift():
    text = "Code BIC/SWIFT: cihmmamc"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bic_swift"]
    assert any(m["value"] == "cihmmamc" for m in matches)

def test_email_does_not_consume_sentence_punctuation():
    text = "Contact client@example.com. Merci."
    matches = detect_emails(text)
    assert len(matches) == 1
    assert matches[0]["value"] == "client@example.com"

def test_detects_international_phone_with_optional_trunk_prefix():
    value = "+212 (0) 6 12 34 56 78"
    matches = detect_phones(f"Téléphone: {value}")
    assert any(m["value"] == value for m in matches)

def test_non_morocco_bic_is_not_matched():
    # bic_swift_morocco is deliberately scoped to Moroccan BICs (country
    # segment == "MA") - a foreign bank's BIC shouldn't match.
    text = "Code BIC/SWIFT: DEUTDEFF for the German account."
    matches = [m for m in run_regex_detectors(text) if m["type"] == "bic_swift"]
    assert matches == []


def test_french_identity_fields_from_sample_document():
    text = "Nom : Yassine El Mansouri\nPasseport : MA8473921"
    matches = run_regex_detectors(text)
    assert any(m["type"] == "person_name" and m["value"] == "Yassine El Mansouri" for m in matches)
    assert any(m["type"] == "passport_number" and m["value"] == "MA8473921" for m in matches)
    assert not any("Passeport" in m["value"] for m in matches if m["type"] == "person_name")


def test_french_secret_labels_detect_only_values():
    text = "Mot de passe : AtlasTest!2026\nClé API : sk_test_51AtlasExample9xK72pQ4"
    matches = run_regex_detectors(text)
    assert any(m["type"] == "hardcoded_secret" and m["value"] == "AtlasTest!2026" for m in matches)
    assert any(m["type"] == "openai_api_key" and m["value"] == "sk_test_51AtlasExample9xK72pQ4" for m in matches)
    assert all("Mot de passe" not in m["value"] and "Clé API" not in m["value"] for m in matches)


def test_contextual_passports_allow_descriptive_words():
    for text, value in [
        ("Passeport marocain: MA1234567", "MA1234567"),
        ("Passport No: XG9081726", "XG9081726"),
        ("رقم جواز السفر: PA7654321", "PA7654321"),
    ]:
        assert any(m["type"] == "passport_number" and m["value"] == value for m in run_regex_detectors(text))


def test_valid_international_ibans_are_detected_without_phone_fragment():
    examples = [
        "FR76 3000 6000 0112 3456 7890 189",
        "GB82 WEST 1234 5698 7654 32",
        "DE89 3704 0044 0532 0130 00",
    ]
    for value in examples:
        matches = run_regex_detectors(f"IBAN: {value}")
        assert any(m["type"] == "iban" and m["value"] == value for m in matches)
        assert not any(m["type"] == "phone_number" for m in matches)


def test_arabic_digits_and_fully_spaced_moroccan_phones():
    examples = ["٠٦١٢٣٤٥٦٧٨", "+٢١٢ ٦ ٩٨ ٧٦ ٥٤ ٣٢", "0 6 1 2 3 4 5 6 7 8"]
    for value in examples:
        assert any(m["type"] == "phone_number" and m["value"] == value for m in run_regex_detectors(f"Téléphone: {value}"))


def test_obfuscated_at_dot_emails_are_detected():
    for value in ["salma [at] example [dot] ma", "mehdi(at)example(dot)org"]:
        assert any(m["type"] == "email" and m["value"] == value for m in run_regex_detectors(value))


def test_structured_literals_without_digits_are_detected():
    for text, value in [
        ("SMTP_PASSWORD=SyntheticMailPassword", "SyntheticMailPassword"),
        ('password: "SyntheticYamlDbPass!"', "SyntheticYamlDbPass!"),
        ('const password = "SyntheticJavascriptPassword!";', "SyntheticJavascriptPassword!"),
    ]:
        assert any(m["type"] == "hardcoded_secret" and m["value"] == value for m in run_regex_detectors(text))


def test_false_positive_fragments_and_negative_secret_context_are_rejected():
    cases = [
        ("Transaction ID: TXN-20260820-984215", "credit_card"),
        ("mongodb+srv://testuser:SyntheticMongoPass@cluster0.example.invalid/dlp", "email"),
        ("The following identifier is not a secret: CustomerServiceFactory.", "hardcoded_secret"),
        ("correlation_id=Zx9Qm2Lp7Vw4Nk8Rt3Ys6Hd1Jf5Bc0Aa", "api_key"),
        ("[PAIR_SECRET_NEGATIVE] correlation_id=Zx9Qm2Lp7Vw4Nk8Rt3Ys6Hd1Jf5Bc0Aa", "api_key"),
        ("téléphone : (+212) [6] 12.34.56.78", "ip_address"),
    ]
    for text, rejected_type in cases:
        assert not any(m["type"] == rejected_type for m in run_regex_detectors(text))


def test_basic_authorization_masks_only_encoded_credential():
    value = "dGVzdHVzZXI6VGVzdFBhc3N3b3JkIQ=="
    matches = run_regex_detectors(f"Authorization: Basic {value}")
    assert any(m["type"] == "hardcoded_secret" and m["value"] == value for m in matches)


def test_labeled_multilingual_people_and_common_international_phones():
    people = [
        ("[PERSON_NAME] Yassine El Mansouri", "Yassine El Mansouri"),
        ("[PERSON_NAME] عبد الرحمن العلوي", "عبد الرحمن العلوي"),
        ("Patient: Salma Bennis", "Salma Bennis"),
        ("The account holder is Adam Carter.", "Adam Carter"),
    ]
    for text, value in people:
        assert any(m["type"] == "person_name" and m["value"] == value for m in run_regex_detectors(text))
    for value in ["+1 (202) 555-0147", "+33 6 12 34 56 78", "+44 7700 900123"]:
        assert any(m["type"] == "phone_number" for m in run_regex_detectors(value))


def test_common_vendor_tokens_and_auth_session_values():
    values = [
        "glpat-abcdefghijklmnopqrstuvwxyz",
        "xoxb-" + "123456789012-123456789012-" + "abcdefghijklmnopqrstuvwx",
        "whsec_test_1234567890abcdefghijklmnop",
        "hf_" + "SyntheticTokenOnly" + "AbCdEfGhIjKlMnOp",
        "npm_synthetic1234567890abcdefghijklmnop",
        "dckr_pat_syntheticabcdefghijklmnopqrst",
    ]
    for value in values:
        assert any(m["type"] == "api_key" and m["value"] == value for m in run_regex_detectors(value))
    assert any(m["type"] == "hardcoded_secret" for m in run_regex_detectors("sessionid=s%3AsyntheticSessionValue.AFakeSignatureOnlyForDLPTest"))


def test_pgp_private_key_and_ipv6():
    pgp = "-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest-only\n-----END PGP PRIVATE KEY BLOCK-----"
    assert any(m["type"] == "private_key" and m["value"] == pgp for m in run_regex_detectors(pgp))
    for value in ["::1", "2001:db8:85a3::8a2e:370:7334"]:
        assert any(m["type"] == "ip_address" and m["value"] == value for m in run_regex_detectors(value))


def test_mongodb_srv_is_one_connection_string_not_an_email():
    value = "mongodb+srv://testuser:SyntheticMongoPass@cluster0.example.invalid/dlp"
    matches = run_regex_detectors(value)
    assert any(m["type"] == "connection_string" and m["value"] == value for m in matches)
    assert not any(m["type"] == "email" for m in matches)


def test_customer_in_prose_is_not_a_person_label():
    text = "The customer lives in Casablanca and works in Rabat."
    assert not any(m["type"] == "person_name" for m in run_regex_detectors(text))
    assert any(m["type"] == "person_name" and m["value"] == "Yassine El Mansouri"
               for m in run_regex_detectors("Customer: Yassine El Mansouri"))


def test_shell_variable_reference_is_not_hardcoded():
    assert run_regex_detectors("TOKEN=$ACCESS_TOKEN") == []


def test_secret_context_does_not_leak_from_previous_record():
    text = (
        "[PAIR_SECRET_POSITIVE] api_key=Zx9Qm2Lp7Vw4Nk8Rt3Ys6Hd1Jf5Bc0Aa\n"
        "[PAIR_SECRET_NEGATIVE] correlation_id=Zx9Qm2Lp7Vw4Nk8Rt3Ys6Hd1Jf5Bc0Aa"
    )
    matches = run_regex_detectors(text)
    assert len([m for m in matches if m["type"] == "api_key"]) == 1


def test_spaced_iban_line_never_emits_phone_fragment():
    text = "[IBAN_SPACED] M A 6 4 0 1 1 5 1 9 0 0 0 0 0 1 2 0 5 0 0 0 5 3 4 9 2"
    assert not any(m["type"] == "phone_number" for m in run_regex_detectors(text))


def test_imei_beats_credit_card_classification():
    text = "IMEI: 490154203237518"
    matches = run_regex_detectors(text)
    assert any(m["type"] == "imei" and m["value"] == "490154203237518" for m in matches)


def test_remaining_structured_secret_formats():
    cases = [
        ("sk_" + "test_51SyntheticTestKey000000000000", "api_key"),
        ("SG." + "abcdefghijklmnopqrstuv." + "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdef", "api_key"),
        ("AccountKey=U3ludGhldGljQWNjb3VudEtleUZvckRMUFRlc3RpbmdPbmx5PT0=", "hardcoded_secret"),
        ("pre_shared_key=SyntheticVpnPsk123!", "hardcoded_secret"),
        ('curl -u "api-user:SyntheticCurlPassword" https://api.example.invalid', "hardcoded_secret"),
        ("CREATE USER gateway_admin WITH PASSWORD 'SyntheticSqlPassword!';", "hardcoded_secret"),
        ("https://synthetic-user:SyntheticGitToken@example.invalid/repo.git", "hardcoded_secret"),
    ]
    for text, expected_type in cases:
        assert any(m["type"] == expected_type for m in run_regex_detectors(text)), text


def test_detects_env_style_secret():
    text = 'DB_PASSWORD=hunter2345'
    matches = [m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret"]
    assert any(m["value"] == "hunter2345" for m in matches)

def test_detects_real_env_style_secret_next_to_placeholder_cases():
    text = "DB_PASSWORD=realSecret123"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret"]
    assert any(m["value"] == "realSecret123" for m in matches)

def test_env_style_secret_ignores_synapse_hardcoded_secret_placeholder():
    text = "DB_PASSWORD=[HARDCODED_SECRET_1]"
    matches = [m for m in run_regex_detectors(text) if m["type"] == "hardcoded_secret"]
    assert matches == []

def test_env_style_secret_ignores_synapse_github_token_placeholder():
    text = "GITHUB_TOKEN=[GITHUB_TOKEN_1]"
    matches = run_regex_detectors(text)
    assert not any(m["type"] in {"hardcoded_secret", "github_token"} for m in matches)

def test_env_style_secret_ignores_prefixed_openai_placeholder():
    text = "OPENAI_API_KEY=sk-proj-[API_KEY_1]"
    matches = run_regex_detectors(text)
    assert not any(m["type"] in {"hardcoded_secret", "openai_api_key"} for m in matches)

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
