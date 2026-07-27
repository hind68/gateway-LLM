from app.detectors.luhn import is_luhn_valid


def test_valid_card_passes():
    assert is_luhn_valid("4532015112830366") is True

def test_valid_card_with_spaces_passes():
    assert is_luhn_valid("4532 0151 1283 0366") is True

def test_random_digits_fail():
    assert is_luhn_valid("1234123412341234") is False

def test_empty_and_no_digit_input_is_invalid():
    # A digit-less input sums to 0, and 0 % 10 == 0 - without an explicit
    # guard this was incorrectly treated as a "valid" card number.
    assert is_luhn_valid("") is False
    assert is_luhn_valid("no digits here") is False