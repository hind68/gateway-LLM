import io
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from PIL import Image, UnidentifiedImageError

from app.schemas import AnalyseRequest, AnalyseResponse, MultiSourceAnalyseResponse
from app.detectors.language import detect_language
from app.detectors.regex_detector import run_regex_detectors
from app.detectors.presidio_detector import detect_with_presidio, warm_up_models
from app.pipeline.dedup import deduplicate_matches
from app.pipeline.ids import assign_ids
from app.pipeline.masking import mask_text
from app.pipeline.alerting import check_and_log_alerts
from app.ingestion.pdf_parser import extract_text_from_pdf_with_ocr
from app.ingestion.ocr import extract_text_from_image_object, OCRExtractionError
from app.ingestion.docx_parser import extract_text_from_docx
from app.ingestion.pptx_parser import extract_text_from_pptx
from app.ingestion.csv_parser import extract_text_from_csv, extract_csv_segments
from app.ingestion.xlsx_parser import extract_text_from_xlsx, extract_xlsx_segments
from app.ingestion.zip_parser import extract_text_from_zip, ZipSafetyError
from app.ingestion.allowed_extensions import PLAIN_TEXT_EXTENSIONS, read_as_plain_text

MAX_TEXT_LENGTH = 50_000

# Belt-and-suspenders against a giant upload: this checks Content-Length
# before the body is read at all, which is a real, separate line of
# defense from the per-endpoint extension checks below - those still
# only run after the (much smaller, already-validated-by-size) file has
# been received. Same 200MB figure as zip_parser's own budget, so a raw
# upload isn't rejected here more strictly than zip_parser would allow
# once it's actually looking inside the archive.
MAX_UPLOAD_BYTES = 200 * 1024 * 1024

# Common Pillow-supported image formats. /analyse-image has no format-
# specific parser to fall back on the way /analyse-file's dispatcher
# does, so this is a fast reject for obviously-wrong uploads (video,
# audio, etc.) before spending time on Image.open().
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"}


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """
    Rejects oversized requests using the Content-Length header, before
    Starlette buffers the body into memory (or a temp file) at all. This
    is the one check in this file that runs ahead of any UploadFile
    parsing - the extension checks in the routes below only help once a
    request has already been accepted and its (bounded) body received.

    Honest limitation: a client using chunked transfer-encoding (no
    Content-Length header) skips this check entirely and only meets the
    per-route extension/size handling further in. Most real HTTP clients
    do send Content-Length for file uploads, but this isn't a complete
    guarantee for every possible client.
    """
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > MAX_UPLOAD_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": f"Request body exceeds the {MAX_UPLOAD_BYTES} byte limit."},
                    )
            except ValueError:
                pass  # malformed header - let normal request handling reject it
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load both NLP backends now, during startup, rather than paying that
    # (multi-second) cost on whichever request happens to arrive first.
    warm_up_models()
    yield


app = FastAPI(title="Local DLP Security Gateway", lifespan=lifespan)
app.add_middleware(MaxBodySizeMiddleware)


def run_pipeline(text: str, user_id: str | None = None) -> dict:
    """
    The single shared detect -> dedup -> id -> alert -> mask pipeline.
    """
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters.",
        )

    lang = detect_language(text)

    # Run Regex + our multilingual NER engine
    combined = run_regex_detectors(text) + detect_with_presidio(text, language=lang)

    deduped = deduplicate_matches(combined)
    final_matches = assign_ids(deduped)

    check_and_log_alerts(final_matches, user_id=user_id)
    masked = mask_text(text, final_matches)

    return {
        "flagged": len(final_matches) > 0,
        "matches": final_matches,
        "masked_text": masked,
    }


def run_pipeline_for_segments(known_text: str, free_text: str, user_id: str | None = None) -> dict:
    """
    Like run_pipeline, but for input already split into a "known PII
    shape" segment and a "free text" segment (see structured_routing.py
    and extract_csv_segments/extract_xlsx_segments). The known segment
    only goes through the regex engine; the free-text segment gets the
    full regex + NER treatment - the NER model is the expensive part of
    this pipeline, and there's no reason to run a ~700MB model on a
    column already labeled "email" or "iban" when a regex pattern
    already covers it. Both segments' matches are merged into one
    response over their combined text, so ids/masking/alerting all see
    a single consistent result exactly like run_pipeline's callers expect.
    """
    if not known_text:
        # No known-type segment at all (true for every file type except
        # CSV/XLSX, and even those if no column header matched) - avoid
        # a spurious leading "\n" that would shift every offset by one
        # for no reason.
        return run_pipeline(free_text, user_id=user_id)

    combined_text = known_text + "\n" + free_text
    if len(combined_text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters.",
        )

    known_matches = run_regex_detectors(known_text)

    lang = detect_language(free_text)
    free_matches = run_regex_detectors(free_text) + detect_with_presidio(free_text, language=lang)
    offset = len(known_text) + 1  # +1 for the "\n" joiner above
    for m in free_matches:
        m["start"] += offset
        m["end"] += offset

    deduped = deduplicate_matches(known_matches + free_matches)
    final_matches = assign_ids(deduped)

    check_and_log_alerts(final_matches, user_id=user_id)
    masked = mask_text(combined_text, final_matches)

    return {
        "flagged": len(final_matches) > 0,
        "matches": final_matches,
        "masked_text": masked,
    }


@app.post("/analyse", response_model=AnalyseResponse)
def analyse(request: AnalyseRequest):
    return run_pipeline(request.text, user_id=request.user_id)


@app.post("/analyse-image", response_model=AnalyseResponse)
def analyse_image(file: UploadFile = File(...), user_id: str | None = Form(None)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext and ext not in _IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {ext!r}. Supported: {', '.join(sorted(_IMAGE_EXTENSIONS))}",
        )

    # Blocking call handles Tesseract OCR correctly in FastAPI's thread pool
    content = file.file.read()

    try:
        image = Image.open(io.BytesIO(content))
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Uploaded file is not a readable image.")

    try:
        extracted_text = extract_text_from_image_object(image)
    except OCRExtractionError:
        # Surface this as a real error rather than quietly returning
        # flagged=False - that would look identical to "no PII found"
        # when the true story is "we couldn't read the image at all".
        raise HTTPException(status_code=422, detail="Could not extract text from the uploaded image.")

    return run_pipeline(extracted_text, user_id=user_id)


@app.post("/analyse-pdf", response_model=AnalyseResponse)
def analyse_pdf(file: UploadFile = File(...), user_id: str | None = Form(None)):
    content = file.file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        extracted_text = extract_text_from_pdf_with_ocr(tmp_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Uploaded file is not a readable PDF.")
    finally:
        os.remove(tmp_path)

    return run_pipeline(extracted_text, user_id=user_id)


# docx/pptx/csv/xlsx/zip parsers existed as standalone modules but nothing
# in main.py ever called them - same class of gap as the earlier PDF/OCR
# wiring issue. One dispatcher endpoint here rather than more copies of
# the same request-handling boilerplate. Source-code/plain-text
# extensions all share one reader (read_as_plain_text) rather than
# needing an entry each.
_FILE_EXTRACTORS = {
    ".docx": extract_text_from_docx,
    ".pptx": extract_text_from_pptx,
    ".csv": extract_text_from_csv,
    ".xlsx": extract_text_from_xlsx,
    ".zip": extract_text_from_zip,
    **{ext: read_as_plain_text for ext in PLAIN_TEXT_EXTENSIONS},
}

# CSV/XLSX get the two-tier regex-only-vs-full-pipeline treatment (see
# run_pipeline_for_segments) instead of the flat single-string dispatch
# above - checked first in analyse_file, below.
_SEGMENTED_EXTRACTORS = {
    ".csv": extract_csv_segments,
    ".xlsx": extract_xlsx_segments,
}


@app.post("/analyse-file", response_model=AnalyseResponse)
def analyse_file(file: UploadFile = File(...), user_id: str | None = Form(None)):
    # Extension is checked before file.file.read() below - an unsupported
    # file (video, audio, or anything else not in _FILE_EXTRACTORS) is
    # rejected on the filename alone, without ever touching its contents.
    # Note this doesn't stop the file from having already been received
    # onto the server as part of normal request handling - see
    # MaxBodySizeMiddleware above for the check that runs before that.
    ext = os.path.splitext(file.filename or "")[1].lower()
    segmented_extractor = _SEGMENTED_EXTRACTORS.get(ext)
    extractor = _FILE_EXTRACTORS.get(ext)
    if segmented_extractor is None and extractor is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext or 'unknown'!r}. "
                   f"Supported: {', '.join(sorted(_FILE_EXTRACTORS))}",
        )

    content = file.file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if segmented_extractor is not None:
            known_text, free_text = segmented_extractor(tmp_path)
        else:
            extracted_text = extractor(tmp_path)
    except ZipSafetyError as e:
        # Distinct from a generic bad-file error: this means the archive
        # was readable but tripped a safety limit (size, entry count,
        # compression ratio, nesting depth) or had nothing usable inside
        # it - worth telling the caller which, rather than a generic
        # "couldn't read it".
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Could not process uploaded {ext} file.")
    finally:
        os.remove(tmp_path)

    # Outside the try/finally above on purpose: run_pipeline(_for_segments)
    # can itself raise HTTPException (e.g. 413 for text over the length
    # limit), which the broad `except Exception` above would otherwise
    # catch and mask as a generic 400 "could not process" error.
    if segmented_extractor is not None:
        return run_pipeline_for_segments(known_text, free_text, user_id=user_id)
    return run_pipeline(extracted_text, user_id=user_id)


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------
# /analyse-message: the actual "text + attachments together" endpoint.
# A message is usually - not always - accompanied by one or more files,
# so both are optional and either (or both) can be present. Every
# supported upload type funnels through _extract_known_free_text so this
# endpoint doesn't need its own copy of the image/pdf/docx/etc dispatch
# logic that analyse_image/analyse_pdf/analyse_file already have.
# ---------------------------------------------------------------------

_ALL_SUPPORTED_UPLOAD_EXTENSIONS = (
    set(_FILE_EXTRACTORS) | set(_SEGMENTED_EXTRACTORS) | _IMAGE_EXTENSIONS | {".pdf"}
)


def _extract_known_free_text(filename: str, tmp_path: str) -> tuple[str, str]:
    """
    Uniform (known_text, free_text) extraction for any supported upload
    type. known_text is only ever non-empty for CSV/XLSX (see
    _SEGMENTED_EXTRACTORS) - everything else's full content counts as
    free text, same as run_pipeline_for_segments treats a plain
    run_pipeline call when there's no known segment at all.
    """
    ext = os.path.splitext(filename or "")[1].lower()

    if ext in _SEGMENTED_EXTRACTORS:
        return _SEGMENTED_EXTRACTORS[ext](tmp_path)

    if ext in _IMAGE_EXTENSIONS:
        try:
            image = Image.open(tmp_path)
        except UnidentifiedImageError as e:
            raise ValueError(f"not a readable image ({e})") from e
        try:
            return "", extract_text_from_image_object(image)
        except OCRExtractionError as e:
            raise ValueError(f"could not extract text from image ({e})") from e

    if ext == ".pdf":
        return "", extract_text_from_pdf_with_ocr(tmp_path)

    if ext in _FILE_EXTRACTORS:
        return "", _FILE_EXTRACTORS[ext](tmp_path)

    raise ValueError(f"unsupported file type {ext or 'unknown'!r}")


@app.post("/analyse-message", response_model=MultiSourceAnalyseResponse)
def analyse_message(
    text: str | None = Form(None),
    files: list[UploadFile] = File([]),
    user_id: str | None = Form(None),
):
    if not text and not files:
        raise HTTPException(status_code=400, detail="Provide text, at least one file, or both.")

    results = []

    if text:
        results.append({"source": "message", **run_pipeline(text, user_id=user_id)})

    for file in files:
        source = file.filename or "unknown"
        ext = os.path.splitext(source)[1].lower()

        # Same "reject cheap, reject early" principle as analyse_file:
        # an unsupported extension is recorded as a skipped source and
        # the loop moves on - one bad attachment among several shouldn't
        # abort the whole message, any more than one bad file inside a
        # zip aborts the rest of the archive (see zip_parser.py).
        if ext not in _ALL_SUPPORTED_UPLOAD_EXTENSIONS:
            results.append({
                "source": source, "flagged": False, "matches": [],
                "masked_text": f"[Skipped: unsupported file type {ext or 'unknown'!r}]",
            })
            continue

        content = file.file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            known_text, free_text = _extract_known_free_text(source, tmp_path)
            result = run_pipeline_for_segments(known_text, free_text, user_id=user_id)
        except HTTPException as e:
            results.append({
                "source": source, "flagged": False, "matches": [],
                "masked_text": f"[Could not process this attachment: {e.detail}]",
            })
            continue
        except Exception as e:
            results.append({
                "source": source, "flagged": False, "matches": [],
                "masked_text": f"[Could not process this attachment: {e}]",
            })
            continue
        finally:
            os.remove(tmp_path)

        results.append({"source": source, **result})

    return {
        "flagged": any(r["flagged"] for r in results),
        "results": results,
    }
