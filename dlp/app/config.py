import os


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


DLP_MAX_TEXT_LENGTH = _int_env("DLP_MAX_TEXT_LENGTH", 50_000)
DLP_MAX_FILE_SIZE_MB = _int_env("DLP_MAX_FILE_SIZE_MB", 20)
DLP_MAX_ATTACHMENTS = _int_env("DLP_MAX_ATTACHMENTS", 5)
DLP_MAX_ZIP_UNCOMPRESSED_MB = _int_env("DLP_MAX_ZIP_UNCOMPRESSED_MB", 50)
DLP_MAX_ZIP_FILES = _int_env("DLP_MAX_ZIP_FILES", 50)
DLP_MAX_ZIP_DEPTH = _int_env("DLP_MAX_ZIP_DEPTH", 3)
DLP_LOG_LEVEL = os.getenv("DLP_LOG_LEVEL", "INFO")
DLP_ADMIN_KEY = os.getenv("DLP_ADMIN_KEY", "")
DLP_CONTEXT_WINDOW = _int_env("DLP_CONTEXT_WINDOW", 80)
DLP_MIN_PERSON_CONFIDENCE = _float_env("DLP_MIN_PERSON_CONFIDENCE", 0.72)
DLP_MIN_SECRET_LENGTH = _int_env("DLP_MIN_SECRET_LENGTH", 20)
DLP_MIN_SECRET_ENTROPY = _float_env("DLP_MIN_SECRET_ENTROPY", 3.3)
DLP_TRANSFORMER_ENABLED = _bool_env("DLP_TRANSFORMER_ENABLED", False)
DLP_TRANSFORMER_MODEL = os.getenv("DLP_TRANSFORMER_MODEL", "")
DLP_TRANSFORMER_MIN_CONFIDENCE = _float_env("DLP_TRANSFORMER_MIN_CONFIDENCE", 0.75)

MAX_UPLOAD_BYTES = DLP_MAX_FILE_SIZE_MB * 1024 * 1024
MAX_ZIP_UNCOMPRESSED_BYTES = DLP_MAX_ZIP_UNCOMPRESSED_MB * 1024 * 1024
