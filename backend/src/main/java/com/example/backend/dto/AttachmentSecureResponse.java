package com.example.backend.dto;

public record AttachmentSecureResponse(
        Long attachmentId,
        String filename,
        String mimeType,
        String extractionStatus,
        String maskedText
) {
}
