package com.example.backend.service;

public record AttachmentMetadata(
        Long id,
        String filename,
        String mimeType,
        long size,
        String decision,
        int safeCharacters,
        int estimatedTokens,
        String extractionStatus
) {
}
