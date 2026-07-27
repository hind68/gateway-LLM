import os
import zipfile
import tempfile

from app.ingestion.allowed_extensions import (
    DOCUMENT_EXTENSIONS,
    PLAIN_TEXT_EXTENSIONS,
    read_as_plain_text,
)

MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024  # 200MB cap across the whole archive
MAX_COMPRESSION_RATIO = 100            # catches classic zip-bomb entries
MAX_ZIP_DEPTH = 2                      # top-level zip (0) + up to 2 levels of nested zips inside it
MAX_FILES = 200                        # caps entry count regardless of size - cheap DoS via many tiny files

# .zip itself is handled specially (recursion), not through this set.
_SUPPORTED_EXTENSIONS = (DOCUMENT_EXTENSIONS | PLAIN_TEXT_EXTENSIONS) - {".zip"}


class ZipSafetyError(Exception):
    pass


def _safe_join(base_dir: str, entry_name: str) -> str:
    target = os.path.normpath(os.path.join(base_dir, entry_name))
    if not target.startswith(os.path.normpath(base_dir) + os.sep):
        raise ZipSafetyError(f"Unsafe path in zip entry: {entry_name!r}")
    return target


def _extract_one(safe_path: str, ext: str) -> str:
    if ext == ".txt" or ext in PLAIN_TEXT_EXTENSIONS:
        return read_as_plain_text(safe_path)
    if ext == ".pdf":
        from app.ingestion.pdf_parser import extract_text_from_pdf_with_ocr
        return extract_text_from_pdf_with_ocr(safe_path)
    if ext == ".docx":
        from app.ingestion.docx_parser import extract_text_from_docx
        return extract_text_from_docx(safe_path)
    if ext == ".pptx":
        from app.ingestion.pptx_parser import extract_text_from_pptx
        return extract_text_from_pptx(safe_path)
    if ext == ".csv":
        from app.ingestion.csv_parser import extract_text_from_csv
        return extract_text_from_csv(safe_path)
    if ext == ".xlsx":
        from app.ingestion.xlsx_parser import extract_text_from_xlsx
        return extract_text_from_xlsx(safe_path)
    raise ValueError(f"No extractor registered for {ext!r}")  # shouldn't happen - ext was pre-checked


def extract_text_from_zip(zip_path: str, _depth: int = 0) -> str:
    if _depth > MAX_ZIP_DEPTH:
        raise ZipSafetyError("Zip nesting too deep - refusing to process further.")

    parts = []
    total_uncompressed = 0
    valid_documents = 0

    with zipfile.ZipFile(zip_path) as zf, tempfile.TemporaryDirectory() as tmp_dir:
        entries = zf.infolist()
        if len(entries) > MAX_FILES:
            raise ZipSafetyError(
                f"Archive contains {len(entries)} entries, exceeding the "
                f"maximum of {MAX_FILES} - refusing to process."
            )

        for info in entries:
            if info.is_dir():
                continue

            # Extension check comes first, before any of the size/ratio
            # accounting or the disk write below - a 2GB video sitting in
            # an otherwise-small zip should cost one filename comparison
            # to reject, not a full extraction to temp storage that then
            # gets thrown away anyway once we notice we can't parse it.
            ext = os.path.splitext(info.filename)[1].lower()
            if ext != ".zip" and ext not in _SUPPORTED_EXTENSIONS:
                parts.append(f"[SYSTEM LOG: Ignored file '{info.filename}' (Unsupported format)]")
                continue

            if info.compress_size > 0:
                ratio = info.file_size / max(info.compress_size, 1)
                if ratio > MAX_COMPRESSION_RATIO:
                    raise ZipSafetyError(
                        f"Entry {info.filename!r} has a suspicious compression "
                        f"ratio ({ratio:.0f}x) - refusing to extract."
                    )

            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED:
                raise ZipSafetyError("Archive exceeds maximum allowed total size.")

            safe_path = _safe_join(tmp_dir, info.filename)
            os.makedirs(os.path.dirname(safe_path), exist_ok=True)

            with zf.open(info) as src, open(safe_path, "wb") as dst:
                dst.write(src.read(MAX_TOTAL_UNCOMPRESSED))

            try:
                if ext == ".zip":
                    parts.append(extract_text_from_zip(safe_path, _depth=_depth + 1))
                else:
                    parts.append(_extract_one(safe_path, ext))
                valid_documents += 1
            except ZipSafetyError as e:
                # A nested zip that itself had nothing usable shouldn't
                # necessarily doom this whole archive if other entries
                # are fine - log it like any other skipped entry instead
                # of propagating a hard failure upward.
                parts.append(f"[SYSTEM LOG: Ignored file '{info.filename}' ({e})]")
            except Exception:
                # One corrupt/unreadable entry doesn't kill the rest.
                parts.append(f"[SYSTEM LOG: Ignored file '{info.filename}' (Could not be processed)]")

    if valid_documents == 0:
        raise ZipSafetyError(
            "Archive contains no supported or readable documents - nothing to analyse."
        )

    return "\n".join(parts)
