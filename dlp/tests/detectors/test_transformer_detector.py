from app.detectors import transformer_detector


def test_disabled_transformer_does_not_import_or_load(monkeypatch):
    transformer_detector._pipeline.cache_clear()
    monkeypatch.setattr(transformer_detector, "DLP_TRANSFORMER_ENABLED", False)
    monkeypatch.setattr(transformer_detector, "DLP_TRANSFORMER_MODEL", "would-download")
    assert transformer_detector.detect_with_transformer("Jean Dupont") == []


def test_transformer_offsets_and_threshold(monkeypatch):
    monkeypatch.setattr(transformer_detector, "_pipeline", lambda: lambda text: [
        {"entity_group": "PER", "start": 8, "end": 19, "score": 0.91},
        {"entity_group": "LOC", "start": 22, "end": 27, "score": 0.99},
    ])
    text = "Contact Jean Dupont à Rabat"
    matches = transformer_detector.detect_with_transformer(text)
    assert len(matches) == 1
    assert text[matches[0]["start"]:matches[0]["end"]] == "Jean Dupont"
