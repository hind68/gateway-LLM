import io
import logging

import fitz  # this is pymupdf's import name, not "pymupdf" itself
from PIL import Image

from app.ingestion.ocr import extract_text_from_image_object

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_path: str) -> str:
    with fitz.open(pdf_path) as doc:
        return "".join(page.get_text() for page in doc)


def extract_text_from_pdf_with_ocr(pdf_path: str) -> str:
    """
    Extracts a page's real text AND OCRs any images embedded on that same
    page - these are not mutually exclusive. A page can have a normal
    paragraph of selectable text plus an embedded photo/screenshot that
    also contains text (e.g. a scanned signature or an inserted image of
    a document); the old either/or approach silently missed PII living
    only inside such an image whenever the page also had real text.

    Pages with zero embedded images skip the OCR path entirely, since
    OCR is meaningfully slower than native text extraction.
    """
    text_parts = []

    with fitz.open(pdf_path) as doc:
        for page in doc:
            text_parts.append(page.get_text())

            for img in page.get_images(full=True):
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    image = Image.open(io.BytesIO(base_image["image"]))
                    text_parts.append("\n" + extract_text_from_image_object(image))
                except Exception as e:
                    # One unreadable embedded image (corrupt stream, an
                    # unsupported codec, a decorative icon Tesseract
                    # chokes on, ...) shouldn't block extraction of the
                    # page's real text or the rest of the document - log
                    # it and move on to the next image.
                    logger.warning("Skipping unreadable embedded image (xref=%s): %s", xref, e)

    return "".join(text_parts)
