package com.example.backend.exceptions;

import com.example.backend.integration.dlp.DlpPublicMatch;
import com.example.backend.service.DlpAttachmentAnalysis;
import java.util.List;
import java.util.Set;

public class DlpBlockedException extends DlpAnalysisException {

    private final String highestSeverity;
    private final Set<String> detectedTypes;
    private final String maskedText;
    private final List<DlpPublicMatch> matches;
    private final List<DlpAttachmentAnalysis> attachments;

    public DlpBlockedException(String highestSeverity, Set<String> detectedTypes) {
        this(highestSeverity, detectedTypes, null, List.of(), List.of());
    }

    public DlpBlockedException(
            String highestSeverity,
            Set<String> detectedTypes,
            String maskedText,
            List<DlpPublicMatch> matches,
            List<DlpAttachmentAnalysis> attachments
    ) {
        super("Message blocked by DLP policy");
        this.highestSeverity = highestSeverity;
        this.detectedTypes = detectedTypes == null ? Set.of() : Set.copyOf(detectedTypes);
        this.maskedText = maskedText;
        this.matches = matches == null ? List.of() : List.copyOf(matches);
        this.attachments = attachments == null ? List.of() : List.copyOf(attachments);
    }

    public String getHighestSeverity() {
        return highestSeverity;
    }

    public Set<String> getDetectedTypes() {
        return detectedTypes;
    }

    public String getMaskedText() {
        return maskedText;
    }

    public List<DlpPublicMatch> getMatches() {
        return matches;
    }

    public List<DlpAttachmentAnalysis> getAttachments() {
        return attachments;
    }
}
