package com.example.backend.integration.dlp;

public record DlpPublicMatch(
        Long attachmentId,
        String source,
        String id,
        String type,
        Integer start,
        Integer end,
        Integer lineNumber,
        String severity,
        String placeholder
) {
}
