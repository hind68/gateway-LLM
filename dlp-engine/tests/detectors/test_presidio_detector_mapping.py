"""
test_presidio_detector.py (the sibling file) exercises detect_with_presidio
against the *real* multilingual NER model, which is the right end-to-end
check but means it can only run where that multi-gigabyte stack is
installed.

This file instead monkeypatches the lazy-loaded pipeline accessor
(_get_pipeline) with a plain fake callable shaped like a transformers
token-classification pipeline's output, so the label-mapping /
confidence-threshold / chunking / schema logic can be verified in
milliseconds, with no model download, in any environment -
presidio_detector.py defers its transformers import into that same
accessor, so simply importing this module never requires the real
package at all.
"""
from app.detectors import presidio_detector as pd


def test_default_language_is_english(monkeypatch):
    # Regression test: an earlier version of this signature required
    # `language` with no default, so detect_with_presidio(text) alone
    # raised a TypeError.
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: []))
    assert pd.detect_with_presidio("no pii here") == []


def test_person_and_location_mapping(monkeypatch):
    text = "My name is Sarah Johnson and I live in Boston"
    fake_predictions = [
        {"entity_group": "PER", "start": 11, "end": 24, "score": 0.95},
        {"entity_group": "LOC", "start": 39, "end": 45, "score": 0.90},
    ]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    matches = pd.detect_with_presidio(text)
    by_type = {m["type"]: m for m in matches}

    assert by_type["name"]["value"] == "Sarah Johnson"
    assert by_type["name"]["source"] == "presidio"
    assert by_type["address"]["value"] == "Boston"


def test_organization_mapping(monkeypatch):
    text = "I work at Acme Corp downtown"
    fake_predictions = [{"entity_group": "ORG", "start": 10, "end": 19, "score": 0.88}]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    matches = pd.detect_with_presidio(text)
    assert matches[0]["type"] == "organization"
    assert matches[0]["value"] == "Acme Corp"


def test_low_confidence_predictions_are_dropped(monkeypatch):
    text = "My name is Sarah Johnson"
    fake_predictions = [{"entity_group": "PER", "start": 11, "end": 24, "score": 0.40}]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    assert pd.detect_with_presidio(text) == []


def test_unmapped_entity_type_is_dropped(monkeypatch):
    # MISC (or anything outside PER/LOC/ORG) has no mapping and should be
    # silently skipped, not crash or leak a raw label into "type".
    text = "The AfricaTech summit happened yesterday"
    fake_predictions = [{"entity_group": "MISC", "start": 4, "end": 14, "score": 0.80}]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    assert pd.detect_with_presidio(text) == []


def test_french_text_uses_same_pipeline(monkeypatch):
    text = "Je m'appelle Karim Ouazzani et j'habite a Casablanca."
    fake_predictions = [
        {"entity_group": "PER", "start": 13, "end": 27, "score": 0.95},
        {"entity_group": "LOC", "start": 42, "end": 52, "score": 0.90},
    ]
    monkeypatch.setattr(pd, "_get_pipeline", lambda: (lambda chunk: fake_predictions))

    matches = pd.detect_with_presidio(text, language="fr")
    by_type = {m["type"]: m for m in matches}

    assert by_type["name"]["value"] == "Karim Ouazzani"
    assert by_type["name"]["source"] == "presidio"
    assert by_type["address"]["value"] == "Casablanca"


def test_same_model_used_for_both_languages():
    # Documents the current design intent: one shared pipeline, not two -
    # see _get_pipeline's docstring for why that matters (loading the
    # same ~700MB model twice under two different names was the bug this
    # replaced).
    assert pd.MULTILINGUAL_MODEL_NAME == "Davlan/bert-base-multilingual-cased-ner-hrl"
    assert not hasattr(pd, "_get_en_pipeline")
    assert not hasattr(pd, "_get_fr_pipeline")


def test_multiple_chunks_are_batched_in_one_call(monkeypatch):
    # Long enough that get_safe_chunks (max_len=400) splits it into (at
    # least) two chunks - the second chunk's "PER" entity is at a small
    # offset *within that chunk*, and must come back mapped to the right
    # *absolute* position in the full text once merged.
    padding = "filler word " * 40  # ~480 chars, forces a second chunk
    text = padding + "My name is Zineb Fassi and nothing else."

    calls = []

    def fake_pipeline(chunk_texts):
        calls.append(chunk_texts)
        # one prediction list per chunk, in the same order - matches
        # what a real batched HF call returns
        results = []
        for chunk in chunk_texts:
            if "Zineb Fassi" in chunk:
                start = chunk.index("Zineb Fassi")
                results.append([{"entity_group": "PER", "start": start, "end": start + len("Zineb Fassi"), "score": 0.9}])
            else:
                results.append([])
        return results

    monkeypatch.setattr(pd, "_get_pipeline", lambda: fake_pipeline)

    matches = pd.detect_with_presidio(text)

    # called exactly once, with a list (batched), not once per chunk
    assert len(calls) == 1
    assert isinstance(calls[0], list)
    assert len(calls[0]) >= 2

    assert len(matches) == 1
    assert matches[0]["value"] == "Zineb Fassi"
    assert text[matches[0]["start"]:matches[0]["end"]] == "Zineb Fassi"


def test_empty_text_does_not_call_pipeline_at_all(monkeypatch):
    # ai_pipeline([]) raises ValueError in the real library (confirmed
    # against HF's source) - detect_with_presidio must never reach that
    # call at all for empty input. _get_pipeline itself raises here (not
    # its return value) so this only passes if the early-return guard
    # skips calling it entirely, rather than calling it and discarding
    # the result.
    def fail_if_called():
        raise AssertionError("_get_pipeline should not have been called for empty text")

    monkeypatch.setattr(pd, "_get_pipeline", fail_if_called)
    assert pd.detect_with_presidio("") == []
