import re
import unicodedata

from app.detectors.presidio_config import SUPPORTED_NLP_LANGUAGES, get_analyzer, warm_up_analyzer
from app.policy import severity_for
from app.config import DLP_CONTEXT_WINDOW, DLP_MIN_PERSON_CONFIDENCE


ENTITY_TYPE_MAP = {
    "EMAIL_ADDRESS": "email",
    "PHONE_NUMBER": "phone_number",
    "CREDIT_CARD": "credit_card",
    "IBAN_CODE": "iban",
    "IP_ADDRESS": "ip_address",
    "URL": "url",
    "ORGANIZATION": "organization",
    "PERSON": "person_name",
    "MOROCCAN_PHONE_LOCAL": "phone_number",
    "MOROCCAN_PHONE_INTERNATIONAL": "phone_number",
    "MOROCCAN_CIN": "moroccan_cin",
    "MA_CIN": "moroccan_cin",
    "MOROCCAN_IBAN": "iban",
    "MOROCCAN_RIB": "bank_account",
    "MOROCCAN_BIC_SWIFT": "bic_swift",
    "OPENAI_API_KEY": "openai_api_key",
    "AWS_ACCESS_KEY": "api_key",
    "GITHUB_TOKEN": "github_token",
    "JWT_TOKEN": "jwt_token",
    "PRIVATE_KEY": "private_key",
    "HARDCODED_PASSWORD": "hardcoded_password",
    "DATABASE_CONNECTION_STRING": "connection_string",
    "BEARER_TOKEN": "bearer_token",
}

_NLP_ACRONYM_FALSE_POSITIVES = {
    "CIN",
    "RIB",
    "IBAN",
    "BIC",
    "SWIFT",
    "JWT",
    "API",
    "SQL",
    "HTTP",
    "HTTPS",
    "IP",
    "GHP",
}

_NLP_SINGLE_TOKEN_FALSE_POSITIVES = {
    "authorization",
    "content type",
    "bearer",
    "api",
    "url",
    "l objectif",
    "donne",
    "donnez",
    "explique",
    "expliquez",
    "java",
    "spring",
    "spring boot",
    "github",
    "openai",
    "gitlab",
    "docker",
    "kubernetes",
    "python",
    "javascript",
    "typescript",
    "maven",
    "gradle",
    "litellm",
}

_GENERIC_NLP_ENTITY_TYPES = {"PERSON", "LOCATION", "ORGANIZATION"}

_NLP_EXCLUDED_TERMS = {
    "authorization",
    "content type",
    "bearer",
    "openai",
    "api",
    "url",
    "spring boot",
    "l objectif",
    "fictives",
    "fichier",
    "telephone",
    "numero",
    "cvv",
    "identite",
    "contact",
    "informations bancaires",
    "carte bancaire de test",
    "identifiants et secrets fictifs",
    "numero de carte",
    "carte nationale",
    "carte d identite",
    "numero de carte d identite",
    "national id",
    "national identity card",
    "identity card",
    "passport number",
    "document number",
}

_TECHNICAL_CONTEXT_PATTERNS = (
    re.compile(r"(^|\s)curl\s+", re.IGNORECASE),
    re.compile(r"\b(?:authorization|content-type|accept|user-agent)\s*:", re.IGNORECASE),
    re.compile(r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+https?://", re.IGNORECASE),
    re.compile(r"\b(?:const|let|var|function|class|public|private|import|return)\b"),
    re.compile(r"\b(?:OPENAI_API_KEY|api[_-]?key|bearer|jwt|token)\b", re.IGNORECASE),
    re.compile(r"[{};=]"),
)


def warm_up_models() -> None:
    warm_up_analyzer()


def detect_with_presidio(text: str, language: str = "en") -> list[dict]:
    if not text or language not in SUPPORTED_NLP_LANGUAGES:
        return []

    results = get_analyzer().analyze(text=text, language=language)
    matches = []
    for result in results:
        if result.entity_type == "LOCATION":
            continue
        detected_text = text[result.start:result.end]
        if _is_generic_nlp_false_positive(
            result.entity_type,
            detected_text,
            text,
            result.start,
            result.end,
        ):
            continue
        if result.entity_type == "PERSON" and float(result.score) < DLP_MIN_PERSON_CONFIDENCE:
            continue

        internal_type = ENTITY_TYPE_MAP.get(result.entity_type)
        if not internal_type:
            continue
        matches.append({
            "type": internal_type,
            "start": result.start,
            "end": result.end,
            "score": float(result.score),
            "severity": severity_for(internal_type),
            "source": "presidio",
            "presidio_entity_type": result.entity_type,
        })
    return matches


def _is_generic_nlp_false_positive(
    entity_type: str,
    detected_text: str,
    full_text: str = "",
    start: int | None = None,
    end: int | None = None,
) -> bool:
    if entity_type not in _GENERIC_NLP_ENTITY_TYPES:
        return False
    normalized_text = _normalize_nlp_text(detected_text)
    if normalized_text in _NLP_EXCLUDED_TERMS:
        return True
    if _is_field_label(full_text, start, end):
        return True
    if _is_technical_context_near_span(full_text, start, end):
        return True
    normalized_upper = detected_text.strip().upper()
    if normalized_upper in _NLP_ACRONYM_FALSE_POSITIVES:
        return True
    normalized_lower = normalized_text
    if entity_type in {"LOCATION", "ORGANIZATION"} and normalized_lower.startswith(("contactez ", "contacter ", "contact ")):
        return True
    return normalized_lower in _NLP_SINGLE_TOKEN_FALSE_POSITIVES


def _is_field_label(text: str, start: int | None, end: int | None) -> bool:
    """Reject an NLP entity when its line position shows it is a field label.

    This filters `Téléphone :`, `Numéro :`, and `CVV :` without filtering the
    value after the colon or relying solely on a language-specific word list.
    """
    if start is None or end is None or not (0 <= start < end <= len(text)):
        return False
    line_end = text.find("\n", end)
    if line_end < 0:
        line_end = len(text)
    return text[end:line_end].lstrip().startswith(":")


def _normalize_nlp_text(value: str) -> str:
    without_accents = "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
    return " ".join(re.sub(r"[^a-z0-9]+", " ", without_accents.lower()).split())


def _is_technical_context(text: str) -> bool:
    if not text:
        return False
    return any(pattern.search(text) for pattern in _TECHNICAL_CONTEXT_PATTERNS)


def _is_technical_context_near_span(
    text: str,
    start: int | None,
    end: int | None,
    radius: int = DLP_CONTEXT_WINDOW,
) -> bool:
    """Filter NLP noise only when the detected span is near technical syntax.

    Applying the technical-content rule to the whole message caused unrelated
    locations and organizations to disappear whenever a code sample or API
    header appeared elsewhere in the same message.
    """
    if not text:
        return False
    if start is None or end is None:
        return _is_technical_context(text)
    line_start = text.rfind("\n", 0, start) + 1
    following_newline = text.find("\n", end)
    line_end = len(text) if following_newline < 0 else following_newline
    window_start = max(line_start, start - radius)
    window_end = min(line_end, end + radius)
    return _is_technical_context(text[window_start:window_end])
