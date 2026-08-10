package com.example.backend.dto;

import com.example.backend.integration.dlp.DlpPublicMatch;
import com.example.backend.service.AttachmentMetadata;
import java.time.Instant;
import java.util.List;

public record MessageResponse(
        Long id,
        String role,
        Integer order,
        String status,
        String content,
        Long responseToMessageId,
        String modelAlias,
        String modelDisplayName,
        String dlpHighestSeverity,
        List<String> dlpDetectedTypes,
        List<DlpPublicMatch> dlpMatches,
        String dlpMaskedText,
        List<AttachmentMetadata> attachments,
        Instant createdAt,
        Instant updatedAt
) {
    public MessageResponse(Long id, String role, Integer ordre, String statut, String contenu,
                            Long responseToId, String modelAlias, String modelDisplayName,
                            Instant createdAt, Instant updatedAt) {
        this(id, role, ordre, statut, contenu, responseToId, modelAlias, modelDisplayName,
                null, List.of(), List.of(), null, List.of(), createdAt, updatedAt);
    }
}
