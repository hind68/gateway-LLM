import logging
import os

import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)

# The Dockerfile (the actual deployment target) apt-installs the tesseract
# binary onto PATH, which pytesseract finds automatically - no explicit
# path needed there. A hardcoded Windows path here would break that
# container entirely, so it's opt-in via env var instead, for local
# Windows dev machines where Tesseract isn't on PATH.
_tesseract_cmd = os.environ.get("TESSERACT_CMD")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd


class OCRExtractionError(RuntimeError):
    """Raised when Tesseract can't process an image."""


def extract_text_from_image_object(image: Image.Image) -> str:
    """
    Takes a PIL Image object and runs Tesseract OCR on it.

    Raises OCRExtractionError on failure rather than swallowing it: this
    is a security tool, and silently returning "" would make a failed scan
    look identical to "no PII found" - a false negative caused by a code
    bug rather than an absence of PII. Callers decide what a failure
    should mean for them (see main.py's /analyse-image, which surfaces it
    as an error, vs. pdf_parser.py, which can skip one bad embedded image
    without failing the whole document).
    """
    try:
        return pytesseract.image_to_string(image, lang="eng+fra+ara").strip()
    except Exception as e:
        logger.warning("OCR extraction failed: %s", e)
        raise OCRExtractionError(str(e)) from e
