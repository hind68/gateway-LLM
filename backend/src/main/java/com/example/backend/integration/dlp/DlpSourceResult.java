package com.example.backend.integration.dlp;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DlpSourceResult(
        String source,
        String status,
        DlpDecision decision,
        Boolean flagged,
        @JsonProperty("highest_severity") String highestSeverity,
        @JsonProperty("extracted_text") String extractedText,
        @JsonProperty("masked_text") String maskedText,
        List<DlpMatch> matches,
        List<DlpError> errors
) {}
