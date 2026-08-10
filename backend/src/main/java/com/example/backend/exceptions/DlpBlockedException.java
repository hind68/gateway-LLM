package com.example.backend.exceptions;

import java.util.Set;

public class DlpBlockedException extends DlpAnalysisException {

    private final String highestSeverity;
    private final Set<String> detectedTypes;

    public DlpBlockedException(String highestSeverity, Set<String> detectedTypes) {
        super("Message blocked by DLP policy");
        this.highestSeverity = highestSeverity;
        this.detectedTypes = detectedTypes == null ? Set.of() : Set.copyOf(detectedTypes);
    }

    public String getHighestSeverity() {
        return highestSeverity;
    }

    public Set<String> getDetectedTypes() {
        return detectedTypes;
    }
}
