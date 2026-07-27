import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

# Resolve relative to this file's own location, not the current working
# directory - "alerts.log" alone depends on where uvicorn happened to be
# launched from, which is fragile (different in Docker, different if a
# teammate runs it from a different folder).
_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "alerts.log")
_LOG_PATH = os.path.normpath(_LOG_PATH)

alert_logger = logging.getLogger("dlp_alerts")
alert_logger.setLevel(logging.WARNING)

# Guard against double-registration: getLogger("dlp_alerts") returns the
# same singleton every time this module is imported, so without this
# check, repeated imports (e.g. under --reload or certain test setups)
# would attach a second handler and duplicate every log line.
if not alert_logger.handlers:
    handler = RotatingFileHandler(_LOG_PATH, maxBytes=5_000_000, backupCount=3)
    handler.setFormatter(logging.Formatter("%(message)s"))
    alert_logger.addHandler(handler)


def check_and_log_alerts(matches: list[dict], user_id: str | None = None) -> None:
    high_severity = [m for m in matches if m["severity"] == "high"]
    if not high_severity:
        return

    alert_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "matches": [
            {
                "id": m["id"],
                "type": m["type"],
                "value": m.get("value", ""),
                "source": m.get("source", "unknown"),
            }
            for m in high_severity
        ],
    }

    alert_logger.warning(json.dumps(alert_entry))