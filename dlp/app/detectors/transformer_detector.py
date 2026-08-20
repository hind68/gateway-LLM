"""Optional lazy multilingual NER adapter.

`transformers` is deliberately not a required dependency. Disabled mode imports
no model library and performs no network access.
"""

from functools import lru_cache
import logging

from app.config import DLP_TRANSFORMER_ENABLED, DLP_TRANSFORMER_MIN_CONFIDENCE, DLP_TRANSFORMER_MODEL
from app.policy import severity_for

logger = logging.getLogger(__name__)
_LABEL_MAP = {"PER": "person_name", "PERSON": "person_name", "ORG": "organization"}


@lru_cache(maxsize=1)
def _pipeline():
    if not DLP_TRANSFORMER_ENABLED or not DLP_TRANSFORMER_MODEL:
        return None
    try:
        from transformers import pipeline  # optional dependency
        return pipeline("token-classification", model=DLP_TRANSFORMER_MODEL, aggregation_strategy="simple")
    except (ImportError, OSError, ValueError) as error:
        logger.warning("Optional DLP transformer unavailable: %s", error)
        return None


def detect_with_transformer(text: str) -> list[dict]:
    model = _pipeline()
    if model is None or not text:
        return []
    matches = []
    for result in model(text):
        label = str(result.get("entity_group", result.get("entity", ""))).removeprefix("B-").removeprefix("I-")
        internal_type = _LABEL_MAP.get(label.upper())
        score = float(result.get("score", 0.0))
        if not internal_type or score < DLP_TRANSFORMER_MIN_CONFIDENCE:
            # LOCATION/ADDRESS remain intentionally disabled by current product direction.
            continue
        start, end = int(result["start"]), int(result["end"])
        if not (0 <= start < end <= len(text)):
            continue
        matches.append({
            "type": internal_type, "start": start, "end": end,
            "score": score, "severity": severity_for(internal_type),
            "source": "transformer", "transformer_entity_type": label,
        })
    return matches
