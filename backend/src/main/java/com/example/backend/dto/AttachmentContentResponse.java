package com.example.backend.dto;

public record AttachmentContentResponse(
        Long id,
        String filename,
        String mimeType,
        long size,
        String decision,
        String extractionStatus
) {
}
