# Local DLP Security Gateway

A local PII-detection and redaction service. Send it text (or an image /
PDF to OCR first), and it flags emails, phone numbers, credit card
numbers, API keys/secrets, names, organizations, and addresses, then
returns a masked version of the text with each match replaced by a
placeholder like `[EMAIL_1_REDACTED]`.

Detection combines two engines:
- **Regex + validation** for structured data (email, phone, credit card
  via Luhn check, API keys/secrets).
- **NLP/NER** for unstructured entities (names, organizations,
  addresses) - Presidio + spaCy (`en_core_web_lg`) for English, a
  CamemBERT NER model for French, auto-selected by language detection.

## Setup

```bash
pip install -r requirements.txt
```

Requires the Tesseract OCR binary for the image/PDF endpoints:
- Debian/Ubuntu: `apt-get install tesseract-ocr tesseract-ocr-fra`
- Windows: install Tesseract separately, then either put it on PATH or
  set the `TESSERACT_CMD` environment variable to its `.exe` path.

Run it:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or with Docker:
```bash
docker compose -f docker_compose.yml up --build
```
The Docker build pre-fetches the French NER model so the container has
zero outbound network dependency at runtime (see the Dockerfile and the
comments in `app/detectors/presidio_detector.py`).

## API

### `POST /analyse`
```json
{"text": "Contact me at john@company.com", "user_id": "optional"}
```

### `POST /analyse-image`
Multipart upload, field `file` (image) + optional form field `user_id`.

### `POST /analyse-pdf`
Multipart upload, field `file` (PDF) + optional form field `user_id`.

All three return:
```json
{
  "flagged": true,
  "matches": [
    {
      "id": "email_1",
      "type": "email",
      "value": "john@company.com",
      "start": 14,
      "end": 31,
      "severity": "medium",
      "source": "regex",
      "score": null
    }
  ],
  "masked_text": "Contact me at [EMAIL_1_REDACTED]"
}
```

### `GET /health`
Liveness check.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `TESSERACT_CMD` | (unset - uses PATH) | Explicit path to the Tesseract binary, mainly for Windows dev machines |
| `FR_NER_MODEL` | `Jean-Baptiste/camembert-ner` | Hugging Face model id (or local path) for French NER |
| `EN_SPACY_MODEL` | `en_core_web_lg` | spaCy model Presidio uses for English |
| `HF_HUB_OFFLINE` | `1` | Forces no Hugging Face network calls at runtime; the Docker build pre-fetches the model so this is safe to leave on |

## Tests

```bash
pytest
```

Most of the suite runs with no extra setup. Two files exercise the real
NLP models directly (`tests/detectors/test_presidio_detector.py`,
parts of `tests/test_main.py`) and need the full `requirements.txt`
installed; the former skips cleanly if `transformers`/`presidio-analyzer`
aren't present. Their `_mapping`/`_mocked` counterparts cover the same
logic with lightweight fakes and always run.
