from app.detectors.iban import is_iban_valid


def test_valid_morocco_iban_passes():
    assert is_iban_valid("MA64 2307 8094 3410 6211 0034 0090") is True

def test_valid_iban_without_spaces_passes():
    assert is_iban_valid("MA64230780943410621100340090") is True

def test_tampered_iban_fails():
    # One digit changed from the valid example above
    assert is_iban_valid("MA65 2307 8094 3410 6211 0034 0090") is False

def test_random_digits_fail():
    assert is_iban_valid("MA12 3456 7890 1234 5678 9012 3456") is False

def test_non_morocco_iban_still_validates():
    # The checksum algorithm is universal (ISO 7064 MOD 97-10), not
    # Morocco-specific - this is the standard textbook German example.
    assert is_iban_valid("DE89 3704 0044 0532 0130 00") is True

def test_too_short_is_invalid():
    assert is_iban_valid("MA1234") is False

def test_empty_and_garbage_input_do_not_crash():
    assert is_iban_valid("") is False
    assert is_iban_valid("MA64.2307.8094") is False
