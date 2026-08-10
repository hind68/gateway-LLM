package com.example.backend.service;

import com.example.backend.integration.dlp.DlpPublicMatch;
import java.util.List;

public record DlpAttachmentAnalysis(
        String source,
        String filename,
        String mimeType,
        long size,
        String decision,
        int safeCharacters,
        int estimatedTokens,
        String extractionStatus,
        String extractedText,
        String maskedText,
        List<DlpPublicMatch> matches
) {
    public AttachmentMetadata metadata(Long id) {
        return new AttachmentMetadata(
                id,
                filename,
                mimeType,
                size,
                decision,
                safeCharacters,
                estimatedTokens,
                extractionStatus
        );
    }
}
