import os


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


DLP_MAX_TEXT_LENGTH = _int_env("DLP_MAX_TEXT_LENGTH", 50_000)
DLP_MAX_FILE_SIZE_MB = _int_env("DLP_MAX_FILE_SIZE_MB", 20)
DLP_MAX_ATTACHMENTS = _int_env("DLP_MAX_ATTACHMENTS", 5)
DLP_MAX_ZIP_UNCOMPRESSED_MB = _int_env("DLP_MAX_ZIP_UNCOMPRESSED_MB", 50)
DLP_MAX_ZIP_FILES = _int_env("DLP_MAX_ZIP_FILES", 50)
DLP_MAX_ZIP_DEPTH = _int_env("DLP_MAX_ZIP_DEPTH", 3)
DLP_LOG_LEVEL = os.getenv("DLP_LOG_LEVEL", "INFO")
DLP_ADMIN_KEY = os.getenv("DLP_ADMIN_KEY", "")

MAX_UPLOAD_BYTES = DLP_MAX_FILE_SIZE_MB * 1024 * 1024
MAX_ZIP_UNCOMPRESSED_BYTES = DLP_MAX_ZIP_UNCOMPRESSED_MB * 1024 * 1024
