from pydantic import BaseModel


class AnalyseRequest(BaseModel):
    text: str
    user_id: str | None = None


class Match(BaseModel):
    id: str
    type: str
    value: str
    start: int
    end: int
    severity: str
    source: str
    score: float | None = None  # only set for presidio-sourced matches


class AnalyseResponse(BaseModel):
    flagged: bool
    matches: list[Match]
    masked_text: str


class SourceResult(BaseModel):
    """One AnalyseResponse's worth of results, tagged with where it came
    from - the message text itself, or a specific attached file."""
    source: str
    flagged: bool
    matches: list[Match]
    masked_text: str


class MultiSourceAnalyseResponse(BaseModel):
    """Response for /analyse-message: a message and its attachments are
    analysed independently (each gets its own ids/masking, since they're
    genuinely separate documents), then rolled up into one response."""
    flagged: bool
    results: list[SourceResult]
