package com.example.backend.integration.dlp;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DlpAnalysisResponse(
        String status,
        DlpDecision decision,
        Boolean flagged,
        @JsonProperty("highest_severity") String highestSeverity,
        @JsonProperty("extracted_text") String extractedText,
        @JsonProperty("masked_text") String maskedText,
        List<DlpMatch> matches,
        List<DlpError> errors
) {
    /** Compatibility constructor for the original DLP response shape. */
    public DlpAnalysisResponse(
            String status,
            DlpDecision decision,
            Boolean flagged,
            String highestSeverity,
            String maskedText,
            List<DlpMatch> matches,
            List<DlpError> errors
    ) {
        this(status, decision, flagged, highestSeverity, null, maskedText, matches, errors);
    }
}
