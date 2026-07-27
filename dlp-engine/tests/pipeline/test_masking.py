from app.pipeline.masking import mask_text, build_placeholder


def test_build_placeholder_uses_id():
    match = {"id": "email_1", "type": "email"}
    assert build_placeholder(match) == "[EMAIL_1_REDACTED]"

def test_mask_single_match():
    text = "Contact john@company.com now"
    matches = [{"id": "email_1", "type": "email", "start": 8, "end": 24}]
    masked = mask_text(text, matches)
    assert masked == "Contact [EMAIL_1_REDACTED] now"

def test_mask_multiple_matches_no_offset_corruption():
    text = "Email a@b.com or call 0612345678"
    matches = [
        {"id": "email_1", "type": "email", "start": 6, "end": 14},
        {"id": "phone_1", "type": "phone", "start": 23, "end": 33},
    ]
    masked = mask_text(text, matches)
    assert "[EMAIL_1_REDACTED]" in masked
    assert "[PHONE_1_REDACTED]" in masked

def test_mask_no_matches_returns_original():
    text = "Nothing sensitive here."
    assert mask_text(text, []) == text