import pytest

# Every test below calls the real detect_with_presidio, which needs the
# full transformers/torch stack - skip cleanly with a clear reason
# instead of failing with a raw ModuleNotFoundError when that stack isn't
# installed. See test_presidio_detector_mapping.py for fast,
# dependency-free coverage of the same mapping/schema logic.
pytest.importorskip("transformers")

from app.detectors.presidio_detector import detect_with_presidio


def test_detects_name():
    text = "My name is Sarah Johnson and I live in Boston"
    matches = detect_with_presidio(text)
    name_match = next(m for m in matches if m["type"] == "name")
    assert name_match["value"] == "Sarah Johnson"
    assert name_match["source"] == "presidio"

def test_detects_address():
    text = "My name is Sarah Johnson and I live in Boston"
    matches = detect_with_presidio(text)
    address_match = next(m for m in matches if m["type"] == "address")
    assert address_match["value"] == "Boston"

def test_offsets_are_correct():
    text = "My name is Sarah Johnson and I live in Boston"
    matches = detect_with_presidio(text)
    for m in matches:
        assert text[m["start"]:m["end"]] == m["value"]

def test_no_pii_returns_empty():
    matches = detect_with_presidio("The weather is nice today.")
    assert matches == []

def test_detects_french_name():
    text = "Je m'appelle Karim Ouazzani et j'habite à Casablanca."
    matches = detect_with_presidio(text, language="fr")
    name_match = next(m for m in matches if m["type"] == "name")
    assert name_match["value"] == "Karim Ouazzani"

def test_detects_french_address():
    text = "Je m'appelle Karim Ouazzani et j'habite à Casablanca."
    matches = detect_with_presidio(text, language="fr")
    address_match = next(m for m in matches if m["type"] == "address")
    assert address_match["value"] == "Casablanca"

def test_french_offsets_are_correct():
    text = "Je m'appelle Karim Ouazzani et j'habite à Casablanca."
    matches = detect_with_presidio(text, language="fr")
    for m in matches:
        assert text[m["start"]:m["end"]] == m["value"]