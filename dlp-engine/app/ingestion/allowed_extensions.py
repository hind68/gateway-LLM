"""
Single source of truth for "which file extensions does this gateway know
how to handle" - both main.py (the /analyse-file endpoint) and
zip_parser.py (deciding what to bother extracting from inside an archive)
import from here, so the two can't quietly drift apart.
"""

# Extensions with a real parser behind them (see main.py's _FILE_EXTRACTORS).
DOCUMENT_EXTENSIONS = frozenset({".docx", ".pptx", ".csv", ".xlsx", ".pdf", ".zip"})

# Plain-text-ish extensions: no special parsing library needed, just read
# as UTF-8 and hand the raw content to the pipeline. Covers source code
# and config files specifically so hardcoded secrets/API keys in a
# development project get scanned, not silently skipped as "unsupported".
PLAIN_TEXT_EXTENSIONS = frozenset({
    ".txt", ".md", ".log",
    # source code
    ".py", ".pyw", ".c", ".h", ".cpp", ".hpp", ".cc", ".cs", ".java",
    ".js", ".jsx", ".ts", ".tsx", ".go", ".rb", ".php", ".rs", ".swift",
    ".kt", ".kts", ".scala", ".sh", ".bash", ".ps1", ".sql", ".r",
    # config / structured-but-text formats
    ".ini", ".cfg", ".conf", ".toml", ".yml", ".yaml",
    ".json", ".xml", ".html", ".htm", ".css"
})

ALLOWED_EXTENSIONS = DOCUMENT_EXTENSIONS | PLAIN_TEXT_EXTENSIONS


def read_as_plain_text(path: str) -> str:
    """Shared reader for anything in PLAIN_TEXT_EXTENSIONS. errors="replace"
    rather than strict UTF-8, since source files are usually but not
    guaranteed to be UTF-8 - one odd byte shouldn't crash the whole scan."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()
