from typing import Literal

from pydantic import BaseModel


Decision = Literal["ALLOW", "MASK", "BLOCK"]
Status = Literal["SUCCESS", "ERROR"]


class AnalyseRequest(BaseModel):
    text: str
    user_id: str | None = None


class Match(BaseModel):
    id: str
    type: str
    start: int
    end: int
    severity: str
    source: str
    score: float | None = None
    presidio_entity_type: str | None = None


class DlpError(BaseModel):
    code: str
    message: str


class AnalyseResponse(BaseModel):
    status: Status = "SUCCESS"
    decision: Decision
    flagged: bool | None
    highest_severity: str | None = None
    masked_text: str | None
    matches: list[Match]
    errors: list[DlpError] = []


class SourceResult(AnalyseResponse):
    """One AnalyseResponse's worth of results, tagged with its source."""
    source: str


class MultiSourceAnalyseResponse(BaseModel):
    """Response for /analyse-message with independent message/attachment results."""
    status: Status = "SUCCESS"
    decision: Decision
    flagged: bool | None
    highest_severity: str | None = None
    results: list[SourceResult]
    errors: list[DlpError] = []

class AnalyseRequest(BaseModel):
    text: str
    user_id: str | None = None
    banned_words: list[str] | None = None
