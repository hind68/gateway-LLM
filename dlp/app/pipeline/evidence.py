"""Small shared evidence helpers; confidence is independent of policy severity."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class DetectionEvidence:
    entity_type: str
    start: int
    end: int
    source: str
    raw_score: float
    normalized_start: int | None = None
    normalized_end: int | None = None
    pattern_name: str | None = None
    validator_passed: bool | None = None
    context_signals: list[str] = field(default_factory=list)
    technical_context_penalty: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def confidence(self) -> float:
        context_bonus = min(0.15, 0.05 * len(self.context_signals))
        validator_bonus = 0.1 if self.validator_passed else 0.0
        return round(max(0.0, min(1.0, self.raw_score + context_bonus + validator_bonus - self.technical_context_penalty)), 4)
