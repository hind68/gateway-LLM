from app.pipeline.dedup import spans_overlap, deduplicate_matches


def test_spans_overlap_true():
    a = {"start": 5, "end": 20}
    b = {"start": 15, "end": 30}
    assert spans_overlap(a, b) is True

def test_spans_overlap_false():
    a = {"start": 5, "end": 10}
    b = {"start": 15, "end": 20}
    assert spans_overlap(a, b) is False

def test_dedup_prefers_regex_on_overlap():
    matches = [
        {"type": "email", "value": "x", "start": 5, "end": 20, "source": "presidio", "severity": "low", "score": 0.4},
        {"type": "email", "value": "x", "start": 5, "end": 20, "source": "regex", "severity": "medium", "score": 0.9},
    ]
    result = deduplicate_matches(matches)
    assert len(result) == 1
    assert result[0]["source"] == "regex"

def test_dedup_keeps_non_overlapping_matches():
    matches = [
        {"type": "email", "value": "a", "start": 0, "end": 5, "source": "regex", "severity": "medium"},
        {"type": "name", "value": "b", "start": 20, "end": 25, "source": "presidio", "severity": "low"},
    ]
    result = deduplicate_matches(matches)
    assert len(result) == 2

def test_dedup_does_not_crash_on_missing_source_key():
    # This is exactly the shape presidio_detector.py used to produce
    # before it was fixed to always include "source" - overlap resolution
    # used to raise KeyError here instead of degrading gracefully.
    matches = [
        {"type": "email", "value": "x", "start": 5, "end": 20, "severity": "low"},
        {"type": "email", "value": "x", "start": 5, "end": 20, "source": "regex", "severity": "medium"},
    ]
    result = deduplicate_matches(matches)
    assert len(result) == 1


def test_dedup_removes_all_overlapping_lower_quality_matches():
    matches = [
        {"type": "openai_api_key", "start": 15, "end": 62, "source": "regex", "severity": "high", "score": 0.8, "pattern_name": "openai_key"},
        {"type": "api_key", "start": 23, "end": 62, "source": "regex", "severity": "high", "score": 0.8, "pattern_name": "generic_secret"},
        {"type": "location", "start": 20, "end": 30, "source": "presidio", "severity": "low", "score": 0.9, "presidio_entity_type": "LOCATION"},
    ]

    result = deduplicate_matches(matches)

    assert len(result) == 1
    assert result[0]["type"] == "openai_api_key"
    assert result[0]["start"] == 15
    assert result[0]["end"] == 62
