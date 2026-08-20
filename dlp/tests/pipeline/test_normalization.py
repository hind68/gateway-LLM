from app.pipeline.normalization import normalize_for_scanning
from app.pipeline.masking import mask_text
from app.pipeline.ids import assign_ids
from app.detectors.regex_detector import run_regex_detectors


def test_nfkc_expansion_maps_to_exact_original_span():
    original = "Email: ｕｓｅｒ@example.com"
    normalized = normalize_for_scanning(original)
    start = normalized.text.index("user@example.com")
    assert original[slice(*normalized.original_span(start, start + len("user@example.com")))] == "ｕｓｅｒ@example.com"


def test_zero_width_email_masks_exact_original_characters():
    text = "Send to user@example.\u200bcom now"
    matches = [match for match in run_regex_detectors(text) if match["type"] == "email"]
    assert text[matches[0]["start"]:matches[0]["end"]] == "user@example.\u200bcom"
    masked = mask_text(text, assign_ids(matches))
    assert masked == "Send to [EMAIL_1] now"


def test_spaced_email_maps_to_full_obfuscated_span():
    text = "Email john @ gmail . com please"
    match = next(match for match in run_regex_detectors(text) if match["type"] == "email")
    assert text[match["start"]:match["end"]] == "john @ gmail . com"


def test_multiple_normalized_detections_keep_original_offsets():
    text = "user@example.\u200bcom puis 06\u00a012\u00a034\u00a056\u00a078"
    matches = run_regex_detectors(text)
    assert all(text[m["start"]:m["end"]] == m["value"] for m in matches)


def test_arabic_digits_normalize_but_map_to_original_glyphs():
    original = "الهاتف ٠٦١٢٣٤٥٦٧٨"
    normalized = normalize_for_scanning(original)
    assert "0612345678" in normalized.text
    start = normalized.text.index("0612345678")
    assert original[slice(*normalized.original_span(start, start + 10))] == "٠٦١٢٣٤٥٦٧٨"
