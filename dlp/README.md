# Secure LLM DLP Service

Local FastAPI service for detecting and masking sensitive data before it is later connected to the Secure LLM Gateway flow.

This version uses a hybrid detector:

- Microsoft Presidio Analyzer with spaCy models for French and English.
- Custom Moroccan recognizers for CIN, Moroccan phones, IBAN/RIB and BIC/SWIFT.
- Custom recognizers and regex rules for technical secrets such as API keys, JWTs, private keys and hardcoded passwords.
- Existing regex validators for structured values, including Luhn for credit cards and MOD-97 for IBAN.

Arabic is limited in this MVP: OCR can use Arabic Tesseract and regex rules still run on Arabic text, but Arabic NER is not supported and Arabic text is not sent through the French spaCy model.

## Endpoints

- `GET /health`
- `GET /ready`
- `POST /analyse`
- `POST /analyse-image`
- `POST /analyse-pdf`
- `POST /analyse-file`
- `POST /analyse-message`

Typical response:

```json
{
  "status": "SUCCESS",
  "decision": "MASK",
  "flagged": true,
  "highest_severity": "medium",
  "masked_text": "Mon adresse est [EMAIL_1]",
  "matches": [
    {
      "id": "email_1",
      "type": "email",
      "start": 16,
      "end": 34,
      "score": 0.8,
      "severity": "medium",
      "source": "regex"
    }
  ],
  "errors": []
}
```

Sensitive values are not returned in `matches` and must not be written to logs. Only `masked_text` may contain the redacted form of submitted content.

## Decisions

Temporary MVP policy:

- no detection: `ALLOW`
- low or medium detection: `MASK`
- high detection: `BLOCK`
- extraction or analysis error: `BLOCK`

Fail closed is intentional: content that cannot be safely analysed is blocked.

## Supported Inputs

- Plain text and common source/config text files.
- PDF with text extraction and OCR fallback.
- Images through Tesseract OCR.
- DOCX, PPTX, CSV, XLSX.
- ZIP archives with path traversal, size, depth, file count, compression-ratio and encrypted-entry protections.

## Limits

Configured through environment variables:

| Variable | Default |
|---|---:|
| `DLP_MAX_TEXT_LENGTH` | `50000` |
| `DLP_MAX_FILE_SIZE_MB` | `20` |
| `DLP_MAX_ATTACHMENTS` | `5` |
| `DLP_MAX_ZIP_UNCOMPRESSED_MB` | `50` |
| `DLP_MAX_ZIP_FILES` | `50` |
| `DLP_MAX_ZIP_DEPTH` | `3` |
| `DLP_LOG_LEVEL` | `INFO` |
| `DLP_CONTEXT_WINDOW` | `80` |
| `DLP_MIN_PERSON_CONFIDENCE` | `0.72` |
| `DLP_MIN_SECRET_LENGTH` | `20` |
| `DLP_MIN_SECRET_ENTROPY` | `3.3` |
| `DLP_TRANSFORMER_ENABLED` | `false` |
| `DLP_TRANSFORMER_MODEL` | empty |
| `DLP_TRANSFORMER_MIN_CONFIDENCE` | `0.75` |

LOCATION/ADDRESS NER is intentionally disabled by current product policy. IP
findings are classified as loopback, private, or public and receive contextual
severity; the configured policy still decides the final action.

By default loopback and plain private IP findings are low severity, public IPs
are medium, and sensitive infrastructure context can raise either category.
Therefore ordinary IP findings are masked while high-context findings block.

## Local Run

Install dependencies and spaCy models:

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python -m spacy download fr_core_news_sm
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Tesseract must be installed locally for OCR endpoints. The Docker image installs English, French and Arabic OCR data.

## Docker

From the project root:

```bash
docker compose build dlp-service
docker compose up -d dlp-service
```

The container downloads spaCy models during image build. It does not need internet access at runtime.

Service URLs:

- host machine: `http://localhost:8000`
- Docker network: `http://dlp-service:8000`

## Tests

```bash
python -m pytest
```

## Accuracy evaluation

The labeled corpus includes French, English, Arabic, and Darija-style positive,
negative, and adversarial samples. From the `dlp` directory:

```bash
python evaluation/evaluate.py --mode regex
python evaluation/evaluate.py --mode full --json-output evaluation/report.json
```

`regex` mode has no NLP model requirement. `full` mode includes Presidio. The
optional transformer adapter requires `transformers` only when explicitly
enabled; it is lazy-loaded and is not imported or downloaded in disabled mode.

## Current Limits

This is not a production banking DLP system. Presidio and custom rules improve coverage but do not guarantee perfect detection. Moroccan rules are custom MVP rules and must be reviewed with real compliance/security requirements before production use.
