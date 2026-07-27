from langdetect import detect, LangDetectException

def detect_language(text: str) -> str:
    try:
        lang = detect(text)
    except LangDetectException:
        return "en"     

    return "fr" if lang == "fr" else "en"