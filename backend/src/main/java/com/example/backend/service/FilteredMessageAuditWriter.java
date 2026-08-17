package com.example.backend.service;

import com.example.backend.entity.FilteredMessage;
import com.example.backend.integration.dlp.DlpAnalysisResponse;
import com.example.backend.repository.FilteredMessageRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class FilteredMessageAuditWriter {

    private final FilteredMessageRepository filteredMessageRepository;

    public FilteredMessageAuditWriter(FilteredMessageRepository filteredMessageRepository) {
        this.filteredMessageRepository = filteredMessageRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordBlocked(UUID userKeycloakId, String originalContent, String reason) {
        save(userKeycloakId, originalContent, null, "BLOCKED", reason, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRedacted(UUID userKeycloakId, String originalContent, String redactedContent, String reason) {
        save(userKeycloakId, originalContent, redactedContent, "REDACTED", reason, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordBlocked(UUID userKeycloakId, String originalContent, String reason, DlpAnalysisResponse response) {
        save(userKeycloakId, originalContent, response == null ? null : response.maskedText(), "BLOCKED", reason, response);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRedacted(UUID userKeycloakId, String originalContent, String redactedContent, String reason, DlpAnalysisResponse response) {
        save(userKeycloakId, originalContent, redactedContent, "REDACTED", reason, response);
    }

    private void save(UUID userId, String original, String redacted, String action, String reason, DlpAnalysisResponse response) {
        FilteredMessage message = new FilteredMessage(userId, original, redacted, action, reason);
        if (response != null) {
            message.setHighestSeverity(response.highestSeverity());
            message.setDetectedTypes(response.matches() == null ? "" : response.matches().stream()
                    .map(match -> match.type()).filter(type -> type != null && !type.isBlank()).distinct().reduce((a, b) -> a + "," + b).orElse(""));
            message.setDetectionCount(response.matches() == null ? 0 : response.matches().size());
            message.setRequestStatus(response.decision().name());
        }
        filteredMessageRepository.save(message);
    }
}
