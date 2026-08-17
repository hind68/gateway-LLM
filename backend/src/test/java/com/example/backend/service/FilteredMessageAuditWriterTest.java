package com.example.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.example.backend.entity.FilteredMessage;
import com.example.backend.integration.dlp.DlpAnalysisResponse;
import com.example.backend.integration.dlp.DlpDecision;
import com.example.backend.repository.FilteredMessageRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FilteredMessageAuditWriterTest {

    @Mock
    private FilteredMessageRepository repository;

    @Test
    void blockedMessageKeepsOnlyTheDlpSafeVersionForDisplay() {
        UUID userId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
        DlpAnalysisResponse response = new DlpAnalysisResponse(
                "SUCCESS", DlpDecision.BLOCK, true, "HIGH", "card [CREDIT_CARD]", List.of(), List.of());
        FilteredMessageAuditWriter writer = new FilteredMessageAuditWriter(repository);

        writer.recordBlocked(userId, "card 4111111111111111", "credit_card", response);

        ArgumentCaptor<FilteredMessage> message = ArgumentCaptor.forClass(FilteredMessage.class);
        verify(repository).save(message.capture());
        assertThat(message.getValue().getRedactedContent()).isEqualTo("card [CREDIT_CARD]");
        assertThat(message.getValue().getAction()).isEqualTo("BLOCKED");
    }
}
