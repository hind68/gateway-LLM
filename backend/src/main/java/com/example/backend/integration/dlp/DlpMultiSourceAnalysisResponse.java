package com.example.backend.integration.dlp;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DlpMultiSourceAnalysisResponse(
        String status,
        DlpDecision decision,
        Boolean flagged,
        @JsonProperty("highest_severity") String highestSeverity,
        List<DlpSourceResult> results,
        List<DlpError> errors
) {}
