package com.example.backend.dto;

import com.example.backend.integration.dlp.DlpPublicMatch;
import java.util.List;

public record AttachmentInspectionResponse(
        Long attachmentId,
        String filename,
        String mimeType,
        String extractionStatus,
        String extractedText,
        List<DlpPublicMatch> matches
) {
}
