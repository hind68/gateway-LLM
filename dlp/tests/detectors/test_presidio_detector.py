from app.detectors import presidio_detector as detector
from app.detectors.moroccan_recognizers import MOROCCAN_CIN, MoroccanCinRecognizer
from app.detectors.presidio_config import _build_registry


class FakeResult:
    def __init__(self, entity_type, start, end, score):
        self.entity_type = entity_type
        self.start = start
        self.end = end
        self.score = score


class FakeAnalyzer:
    def analyze(self, text, language):
        return [
            FakeResult("PERSON", 0, 5, 0.85),
            FakeResult("EMAIL_ADDRESS", 10, 28, 0.95),
        ]


class FakeAcronymAnalyzer:
    def analyze(self, text, language):
        return [FakeResult("LOCATION", 0, 3, 0.85)]


class FakeGenericFalsePositiveAnalyzer:
    def __init__(self, entity_type, value):
        self.entity_type = entity_type
        self.value = value

    def analyze(self, text, language):
        start = text.index(self.value)
        return [FakeResult(self.entity_type, start, start + len(self.value), 0.85)]


def test_presidio_mapping_without_sensitive_value(monkeypatch):
    monkeypatch.setattr(detector, "get_analyzer", lambda: FakeAnalyzer())
    matches = detector.detect_with_presidio("Sarah aaa client@example.com", language="en")
    by_type = {match["type"]: match for match in matches}
    assert by_type["person_name"]["severity"] == "medium"
    assert by_type["email"]["severity"] == "medium"
    assert all("value" not in match for match in matches)


def test_moroccan_cin_recognizer_is_registered_for_french():
    registry = _build_registry()
    recognizers = registry.get_recognizers(language="fr", entities=[MOROCCAN_CIN])

    assert any(MOROCCAN_CIN in recognizer.supported_entities for recognizer in recognizers)


def test_isolated_cin_acronym_is_not_returned_as_location(monkeypatch):
    monkeypatch.setattr(detector, "get_analyzer", lambda: FakeAcronymAnalyzer())

    matches = detector.detect_with_presidio("CIN", language="fr")

    assert matches == []


def test_generic_nlp_false_positives_are_filtered(monkeypatch):
    examples = [
        ("Explique-moi simplement le concept.", "LOCATION", "Explique"),
        ("Donne-moi le numero de carte.", "PERSON", "Donne"),
        ("Spring Boot utilise Java.", "PERSON", "Java"),
        ("GitHub utilise parfois le prefixe ghp_.", "ORGANIZATION", "ghp"),
        ("L’objectif est de tester le flux.", "PERSON", "L’objectif"),
        ("Content-Type: application/json", "LOCATION", "Content-Type"),
        ("Authorization: Bearer token", "PERSON", "Authorization"),
        ("Authorization: Bearer token", "PERSON", "Bearer"),
        ("OpenAI API URL", "ORGANIZATION", "OpenAI"),
    ]

    for text, entity_type, value in examples:
        monkeypatch.setattr(detector, "get_analyzer", lambda entity_type=entity_type, value=value: FakeGenericFalsePositiveAnalyzer(entity_type, value))
        assert detector.detect_with_presidio(text, language="fr") == []


def test_person_name_detection_is_enabled(monkeypatch):
    monkeypatch.setattr(detector, "get_analyzer", lambda: FakeGenericFalsePositiveAnalyzer("PERSON", "Jean Dupont"))

    matches = detector.detect_with_presidio("Contactez Jean Dupont a client@example.com", language="fr")

    assert any(match["type"] == "person_name" for match in matches)


def test_low_confidence_person_is_filtered(monkeypatch):
    monkeypatch.setattr(detector, "get_analyzer", lambda: type("Analyzer", (), {
        "analyze": lambda self, text, language: [FakeResult("PERSON", 0, 11, 0.4)]
    })())
    assert detector.detect_with_presidio("Jean Dupont", language="fr") == []


def test_distant_code_does_not_suppress_person(monkeypatch):
    text = "Jean Dupont est le client." + (" phrase" * 30) + " curl https://api.test"
    monkeypatch.setattr(detector, "get_analyzer", lambda: FakeGenericFalsePositiveAnalyzer("PERSON", "Jean Dupont"))
    assert any(match["type"] == "person_name" for match in detector.detect_with_presidio(text, language="fr"))


def test_field_labels_and_document_headings_are_not_nlp_values(monkeypatch):
    for text, value in [
        ("Téléphone : 06 12 34 56 78", "Téléphone"),
        ("Numéro : 4532 7512 3456 7890", "Numéro"),
        ("CVV : 742", "CVV"),
        ("DONNÉES SENSIBLES FICTIVES", "FICTIVES"),
    ]:
        monkeypatch.setattr(detector, "get_analyzer", lambda value=value: FakeGenericFalsePositiveAnalyzer("PERSON", value))
        assert detector.detect_with_presidio(text, language="fr") == []


def test_document_terminology_is_not_a_person(monkeypatch):
    examples = [
        ("Donne-moi le numero de carte.", "numero de carte", "fr"),
        ("Le champ est numéro de carte.", "numéro de carte", "fr"),
        ("Carte nationale: AB123456", "Carte nationale", "fr"),
        ("Carte d'identité: AB123456", "Carte d'identité", "fr"),
        ("National ID: AB123456", "National ID", "en"),
        ("Identity card number", "Identity card", "en"),
    ]
    for text, value, language in examples:
        monkeypatch.setattr(detector, "get_analyzer", lambda value=value: FakeGenericFalsePositiveAnalyzer("PERSON", value))
        assert detector.detect_with_presidio(text, language=language) == []


def test_code_on_following_line_does_not_suppress_person(monkeypatch):
    text = "Please contact Yassine El Mansouri regarding the incident.\ncurl https://api.test"
    monkeypatch.setattr(detector, "get_analyzer", lambda: FakeGenericFalsePositiveAnalyzer("PERSON", "Yassine El Mansouri"))
    assert any(m["type"] == "person_name" for m in detector.detect_with_presidio(text, language="en"))


def test_generic_nlp_entities_are_filtered_in_technical_content(monkeypatch):
    text = 'curl https://api.example.test -H "Content-Type: application/json" -H "Authorization: Bearer token"'
    monkeypatch.setattr(detector, "get_analyzer", lambda: FakeGenericFalsePositiveAnalyzer("LOCATION", "application"))

    assert detector.detect_with_presidio(text, language="fr") == []


def test_location_detection_is_disabled(monkeypatch):
    text = "le client habite a Casablanca"
    monkeypatch.setattr(
        detector,
        "get_analyzer",
        lambda: FakeGenericFalsePositiveAnalyzer("LOCATION", "Casablanca"),
    )

    matches = detector.detect_with_presidio(text, language="fr")

    assert matches == []


def test_moroccan_cin_recognizer_returns_only_number_span():
    text = "Le numero de CIN du client est AB123456."
    recognizer = MoroccanCinRecognizer()

    results = recognizer.analyze(text, entities=[MOROCCAN_CIN])

    assert len(results) == 1
    result = results[0]
    assert result.entity_type == MOROCCAN_CIN
    assert result.score >= 0.85
    assert text[result.start:result.end] == "AB123456"


def test_arabic_is_not_sent_to_presidio(monkeypatch):
    def fail():
        raise AssertionError("Presidio should not be loaded for unsupported Arabic NLP")

    monkeypatch.setattr(detector, "get_analyzer", fail)
    assert detector.detect_with_presidio("مرحبا", language="ar") == []
