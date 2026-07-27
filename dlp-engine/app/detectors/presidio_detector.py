import logging
import os
import threading

# Force offline mode by default so your demo never fails without Wi-Fi
os.environ.setdefault("HF_HUB_OFFLINE", "1")
logger = logging.getLogger(__name__)

# THE MULTILINGUAL BASE MODEL (~700MB, Highly accurate for Moroccan names)
# We use the exact same model for both English and French!
MULTILINGUAL_MODEL_NAME = "Davlan/bert-base-multilingual-cased-ner-hrl"

_pipeline = None
_load_lock = threading.Lock()

def _get_pipeline():
    """
    One shared pipeline for both languages. A prior version called
    pipeline(model=MULTILINGUAL_MODEL_NAME, ...) separately for French and
    English on the assumption that HF would recognize the identical model
    name and only load it once - it doesn't. transformers.pipeline() has
    no such deduplication; each call independently does its own
    from_pretrained() and loads a fresh copy into RAM. Two calls meant
    ~700MB loaded twice (~1.4GB) for a single model doing the same job
    either way. HF's own documented pattern for sharing one model across
    multiple pipelines is to load it once and pass the object explicitly -
    this is that, simplified to the single-model case.
    """
    global _pipeline
    if _pipeline is None:
        with _load_lock:
            if _pipeline is None:
                from transformers import pipeline,AutoTokenizer, AutoModelForTokenClassification
                logger.info(f"Loading multilingual NER model: {MULTILINGUAL_MODEL_NAME}")
                
                tokenizer = AutoTokenizer.from_pretrained(MULTILINGUAL_MODEL_NAME)
                model = AutoModelForTokenClassification.from_pretrained(MULTILINGUAL_MODEL_NAME)
                
                _pipeline = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
    return _pipeline

def warm_up_models() -> None:
    """Called by main.py at startup to load the model into RAM before the first request."""
    _get_pipeline()

# Map the AI's raw labels to our clean internal types
_LABEL_MAP = {
    "PER": "name", "LOC": "address", "ORG": "organization", # Standard labels
    "LABEL_1": "name", "LABEL_2": "organization", "LABEL_3": "address" # Fallbacks
}

def get_safe_chunks(text: str, max_len: int = 400) -> list[tuple[str, int]]:
    """Safely splits text into chunks without breaking words to protect the CPU."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_len, len(text))
        if end < len(text):
            break_point = max(text.rfind(' ', start, end), text.rfind('\n', start, end))
            if break_point > start:
                end = break_point + 1
        chunks.append((text[start:end], start))
        start = end
    return chunks

def detect_with_presidio(text: str, language: str = "en") -> list[dict]:
    """The main scanner using native HuggingFace pipelines and text chunking."""
    # language kept for API compatibility / call-site clarity, but no
    # longer selects a model - one multilingual model serves both.
    chunks = get_safe_chunks(text)
    if not chunks:
        return []  # ai_pipeline([]) raises ValueError - nothing to send at all here

    ai_pipeline = _get_pipeline()
    chunk_texts = [c[0] for c in chunks]

    # One batched call rather than one call per chunk in a loop: HF's
    # TokenClassificationPipeline accepts str or List[str] and returns a
    # flat list of entity dicts for a single string, or a list of lists
    # (one per input, same order) for a list - batching amortizes the
    # pipeline's fixed per-call overhead across every chunk instead of
    # paying it once per chunk. get_safe_chunks already bounds each
    # chunk to ~400 chars, which also sidesteps the usual batching
    # pitfall of one long outlier forcing the whole batch to pad up to
    # its length.
    raw_results = ai_pipeline(chunk_texts)

    # Normalize defensively rather than assume: if the first element is
    # a dict rather than a list, we got back a flat list of entities
    # (only possible/valid if there was exactly one chunk) instead of
    # one list per chunk.
    if raw_results and isinstance(raw_results[0], dict):
        batch_predictions = [raw_results]
    else:
        batch_predictions = raw_results

    formatted_results = []
    for (chunk_text, start_offset), predictions in zip(chunks, batch_predictions):
        for p in predictions:
            # DYNAMIC THRESHOLD: We ignore guesses under 60% confidence
            if p.get("score", 0) < 0.60:
                continue

            # Handle potential B- prefix from some models
            eg = p["entity_group"]
            if eg.startswith("B-") or eg.startswith("I-"):
                eg = eg[2:]

            canonical_type = _LABEL_MAP.get(eg, _LABEL_MAP.get(p["entity_group"]))
            if not canonical_type:
                continue

            absolute_start = p["start"] + start_offset
            absolute_end = p["end"] + start_offset

            formatted_results.append({
                "type": canonical_type,
                "value": text[absolute_start:absolute_end],
                "start": absolute_start,
                "end": absolute_end,
                "score": float(p["score"]),
                "severity": "medium",
                "source": "presidio"
            })

    return formatted_results