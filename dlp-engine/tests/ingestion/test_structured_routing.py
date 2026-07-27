from app.ingestion.structured_routing import classify_columns


def test_known_type_headers_route_to_regex():
    result = classify_columns(["Email", "phone_number", "CIN", "user_id"])
    assert all(result)

def test_free_text_headers_route_to_full_pipeline():
    result = classify_columns(["Notes", "Description", "Comments"])
    assert not any(result)

def test_substring_false_positives_are_avoided():
    # "id" is a substring of "Video", "tel" is a substring of "Hotel" -
    # naive substring matching (rather than whole-word matching) would
    # wrongly classify these as known-type columns.
    result = classify_columns(["Video", "Hotel Name"])
    assert result == [False, False]

def test_mixed_header_row():
    result = classify_columns(["email", "notes", "iban"])
    assert result == [True, False, True]

def test_empty_and_none_headers_default_to_free_text():
    result = classify_columns(["", None, "  "])
    assert result == [False, False, False]
