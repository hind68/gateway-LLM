import re
import unicodedata

from presidio_analyzer import AnalysisExplanation, EntityRecognizer, Pattern, PatternRecognizer, RecognizerResult

from app.detectors.iban import is_iban_valid


MOROCCAN_PHONE_LOCAL = "MOROCCAN_PHONE_LOCAL"
MOROCCAN_PHONE_INTERNATIONAL = "MOROCCAN_PHONE_INTERNATIONAL"
MOROCCAN_CIN = "MA_CIN"
MOROCCAN_IBAN = "MOROCCAN_IBAN"
MOROCCAN_RIB = "MOROCCAN_RIB"
MOROCCAN_BIC_SWIFT = "MOROCCAN_BIC_SWIFT"


_CIN_CONTEXT_TERMS = (
    "cin",
    "c i n",
    "cnie",
    "carte nationale",
    "carte d identite",
    "carte identite",
    "numero d identite",
    "identite nationale",
    "identifiant national",
    "national id",
    "id card",
    "identity card",
    "national identity",
    "البطاقة الوطنية",
    "بطاقة التعريف",
    "رقم البطاقة",
    "رقم التعريف الوطني",
)


def _normalize_context(text: str) -> str:
    without_accents = "".join(
        char for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    )
    latin_context = re.sub(r"[^a-z0-9]+", " ", without_accents.lower()).strip()
    return f"{latin_context} {text}"


class MoroccanCinRecognizer(EntityRecognizer):
    """
    Detects Moroccan CIN numbers only when a nearby identity-card context
    confirms the candidate. Presidio's generic PatternRecognizer reports the
    full regex match, so this custom recognizer returns only the CIN number
    span while keeping the MA_CIN entity type.
    """

    _candidate_pattern = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]{1,2}\d{5,8}(?![A-Za-z0-9])")

    def __init__(self) -> None:
        super().__init__(
            supported_entities=[MOROCCAN_CIN],
            supported_language="fr",
            name="Moroccan contextual CIN recognizer",
        )

    def analyze(self, text: str, entities: list[str], nlp_artifacts=None) -> list[RecognizerResult]:
        if MOROCCAN_CIN not in entities:
            return []

        results = []
        for candidate in self._candidate_pattern.finditer(text):
            window_start = max(0, candidate.start() - 80)
            window_end = min(len(text), candidate.end() + 40)
            context_window = _normalize_context(text[window_start:window_end])
            if not any(term in context_window for term in _CIN_CONTEXT_TERMS):
                continue

            explanation = AnalysisExplanation(
                recognizer=self.name,
                original_score=0.9,
                textual_explanation="Moroccan CIN shape with nearby identity-card context",
            )
            results.append(RecognizerResult(
                entity_type=MOROCCAN_CIN,
                start=candidate.start(),
                end=candidate.end(),
                score=0.9,
                analysis_explanation=explanation,
            ))
        return results


class MoroccanIbanRecognizer(PatternRecognizer):
    def validate_result(self, pattern_text: str) -> bool:
        return is_iban_valid(pattern_text)


def build_moroccan_recognizers() -> list[PatternRecognizer]:
    return [
        PatternRecognizer(
            supported_entity=MOROCCAN_PHONE_LOCAL,
            name="Moroccan local phone recognizer",
            patterns=[Pattern("moroccan_phone_local", r"\b0[5-7](?:[\s.-]?\d{2}){4}\b", 0.65)],
            supported_language="fr",
            context=["telephone", "tel", "mobile", "gsm", "phone"],
        ),
        PatternRecognizer(
            supported_entity=MOROCCAN_PHONE_INTERNATIONAL,
            name="Moroccan international phone recognizer",
            patterns=[Pattern("moroccan_phone_international", r"(?:\+212|00212)[\s.-]?[5-7](?:[\s.-]?\d{2}){4}", 0.72)],
            supported_language="fr",
            context=["telephone", "tel", "mobile", "gsm", "phone"],
        ),
        MoroccanCinRecognizer(),
        MoroccanIbanRecognizer(
            supported_entity=MOROCCAN_IBAN,
            name="Moroccan IBAN recognizer",
            patterns=[Pattern("moroccan_iban", r"\bMA\d{2}(?:[ ]?\d{4}){6}\b", 0.9)],
            supported_language="fr",
            context=["iban", "rib", "compte bancaire", "coordonnees bancaires", "bank account"],
        ),
        PatternRecognizer(
            supported_entity=MOROCCAN_RIB,
            name="Moroccan RIB recognizer",
            patterns=[
                Pattern("moroccan_rib_spaced", r"(?i)\b(?:rib|compte bancaire|coordonnees bancaires|coordonnées bancaires|bank account)\b[^0-9]{0,24}(\d{3}\s+\d{3}\s+\d{10,16}\s+\d{2})\b", 0.75),
                Pattern("moroccan_rib_compact", r"(?i)\b(?:rib|compte bancaire|coordonnees bancaires|coordonnées bancaires|bank account)\b[^0-9]{0,24}(\d{24})\b", 0.75),
            ],
            supported_language="fr",
            context=["rib", "compte bancaire", "coordonnees bancaires", "bank account"],
        ),
        PatternRecognizer(
            supported_entity=MOROCCAN_BIC_SWIFT,
            name="Moroccan BIC/SWIFT recognizer",
            patterns=[Pattern("moroccan_bic_swift", r"\b[A-Z]{4}MA[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b", 0.7)],
            supported_language="fr",
            context=["bic", "swift", "bank"],
        ),
    ]
