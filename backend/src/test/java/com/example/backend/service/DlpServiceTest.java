package com.example.backend.service;

import com.example.backend.integration.dlp.DlpAnalysisResponse;
import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.integration.dlp.DlpClient;
import com.example.backend.integration.dlp.DlpDecision;
import com.example.backend.exceptions.DlpInvalidResponseException;
import com.example.backend.integration.dlp.DlpMatch;
import com.example.backend.exceptions.DlpUnavailableException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class DlpServiceTest {

    @Mock
    private DlpClient dlpClient;

    @Mock
    private FilteredMessageAuditWriter auditWriter;

    @InjectMocks
    private DlpService dlpService;

    @Test
    void allowReturnsMaskedTextFromDlp() {
        when(dlpClient.analyse("hello", "demo-user", List.of()))
                .thenReturn(response(DlpDecision.ALLOW, "hello", List.of()));

        String safeText = dlpService.safeTextForLlm("hello", "demo-user", List.of());

        assertThat(safeText).isEqualTo("hello");
    }

    @Test
    void maskReturnsMaskedTextFromDlp() {
        when(dlpClient.analyse("key abc", "demo-user", List.of()))
                .thenReturn(response(DlpDecision.MASK, "key [MASKED]", List.of()));

        String safeText = dlpService.safeTextForLlm("key abc", "demo-user", List.of());

        assertThat(safeText).isEqualTo("key [MASKED]");
    }

    @Test
    void blockThrowsBeforeAnyCallerCanReachLlm() {
        DlpMatch match = new DlpMatch("1", "moroccan_cin", 0, 3, "HIGH", "regex", 1.0, null);
        DlpMatch duplicateMatch = new DlpMatch("2", "moroccan_cin", 5, 8, "HIGH", "regex", 1.0, null);
        when(dlpClient.analyse("key abc", "demo-user", List.of()))
                .thenReturn(response(DlpDecision.BLOCK, null, List.of(match, duplicateMatch)));

        assertThatThrownBy(() -> dlpService.safeTextForLlm("key abc", "demo-user", List.of()))
                .isInstanceOf(DlpBlockedException.class)
                .satisfies(exception -> {
                    DlpBlockedException blocked = (DlpBlockedException) exception;
                    assertThat(blocked.getHighestSeverity()).isEqualTo("HIGH");
                    assertThat(blocked.getDetectedTypes()).containsExactly("moroccan_cin");
                });
    }

    @Test
    void invalidDlpStatusFailsClosed() {
        when(dlpClient.analyse("hello", "demo-user", List.of()))
                .thenReturn(new DlpAnalysisResponse("ERROR", DlpDecision.ALLOW, false, null, "hello", List.of(), List.of()));

        assertThatThrownBy(() -> dlpService.safeTextForLlm("hello", "demo-user", List.of()))
                .isInstanceOf(DlpUnavailableException.class);
    }

    @Test
    void allowWithoutMaskedTextFailsClosed() {
        when(dlpClient.analyse("hello", "demo-user", List.of()))
                .thenReturn(response(DlpDecision.ALLOW, null, List.of()));

        assertThatThrownBy(() -> dlpService.safeTextForLlm("hello", "demo-user", List.of()))
                .isInstanceOf(DlpInvalidResponseException.class);
    }

    @Test
    void safeUserMessageAuditsRedactionAndReturnsMaskedText() {
        UUID userId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
        DlpMatch match = new DlpMatch("1", "email", 0, 16, "HIGH", "regex", 1.0, null);
        when(dlpClient.analyse("email client@example.com", "demo-user", List.of()))
                .thenReturn(response(DlpDecision.MASK, "email [EMAIL]", List.of(match)));

        String safeText = dlpService.safeUserMessage(
                "email client@example.com", userId, "demo-user", List.of());

        assertThat(safeText).isEqualTo("email [EMAIL]");
        verify(auditWriter).recordRedacted(
                eq(userId), eq("email client@example.com"), eq("email [EMAIL]"), eq("email"), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void safeUserMessageAuditsBlockedContentBeforeThrowing() {
        UUID userId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
        DlpMatch match = new DlpMatch("1", "credit_card", 0, 16, "HIGH", "regex", 1.0, null);
        when(dlpClient.analyse("card 4111111111111111", "demo-user", List.of()))
                .thenReturn(response(DlpDecision.BLOCK, "card [CREDIT_CARD]", List.of(match)));

        assertThatThrownBy(() -> dlpService.safeUserMessage(
                "card 4111111111111111", userId, "demo-user", List.of()))
                .isInstanceOf(DlpBlockedException.class)
                .satisfies(exception -> {
                    DlpBlockedException blocked = (DlpBlockedException) exception;
                    assertThat(blocked.getMaskedText()).isEqualTo("card [CREDIT_CARD]");
                    assertThat(blocked.getMatches()).hasSize(1);
                    assertThat(blocked.getMatches().get(0).source()).isEqualTo("message");
                });

        verify(auditWriter).recordBlocked(
                eq(userId), eq("card 4111111111111111"), eq("credit_card"), org.mockito.ArgumentMatchers.any());
    }

    private DlpAnalysisResponse response(DlpDecision decision, String maskedText, List<DlpMatch> matches) {
        return new DlpAnalysisResponse("SUCCESS", decision, false, "HIGH", maskedText, matches, List.of());
    }
}
