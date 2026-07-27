from app.detectors.language import detect_language


def test_detects_english():
    text = "Hello, my name is John and I live in Boston."
    assert detect_language(text) == "en"

def test_detects_french():
    text = "Bonjour, je m'appelle Karim et j'habite à Casablanca."
    assert detect_language(text) == "fr"

def test_empty_text_falls_back_to_english():
    assert detect_language("") == "en"

def test_defaults_non_fr_non_en_to_english():
    text = "Hallo, ich heiße Karim und wohne in Berlin."  # German
    assert detect_language(text) == "en"