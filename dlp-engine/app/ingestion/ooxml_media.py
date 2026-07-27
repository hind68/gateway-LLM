"""
Shared helper for docx_parser.py and pptx_parser.py: both formats are
zip archives (Office Open XML) with embedded images stored under a
media/ folder (word/media/ for docx, ppt/media/ for pptx), regardless of
how those images are referenced from the document/slide XML (inline,
floating, in a header/footer, etc). Reading directly from the archive's
media folder catches every embedded image unconditionally, rather than
walking python-docx/python-pptx's relationship graph and needing to
handle each placement style separately.

This mirrors pdf_parser.py's existing approach: extract native text AND
OCR embedded images, since a document can have both a real paragraph of
text and a pasted screenshot/scanned photo that also contains text (e.g.
someone pasting a photo of their CIN card into a report).
"""
import io
import logging
import zipfile

from PIL import Image

from app.ingestion.ocr import extract_text_from_image_object

logger = logging.getLogger(__name__)


def extract_text_from_embedded_images(archive_path: str, media_prefix: str) -> list[str]:
    """
    archive_path: path to the .docx/.pptx file (itself a zip archive).
    media_prefix: "word/media/" for docx, "ppt/media/" for pptx.
    Returns one string per embedded image that produced any OCR text -
    images that fail to decode or OCR are logged and skipped, same as
    pdf_parser.py's per-image handling, so one bad image doesn't block
    text extraction from the rest of the document.
    """
    texts = []
    with zipfile.ZipFile(archive_path) as zf:
        media_files = [n for n in zf.namelist() if n.startswith(media_prefix) and not n.endswith("/")]
        for name in media_files:
            try:
                image = Image.open(io.BytesIO(zf.read(name)))
                text = extract_text_from_image_object(image)
                if text:
                    texts.append(text)
            except Exception as e:
                logger.warning("Skipping unreadable embedded image %r: %s", name, e)
    return texts
