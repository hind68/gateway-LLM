package com.example.backend.service;

import com.example.backend.dto.AttachmentInspectionResponse;
import com.example.backend.dto.AttachmentSecureResponse;
import com.example.backend.entity.Attachment;
import com.example.backend.entity.Conversation;
import com.example.backend.entity.Message;
import com.example.backend.integration.dlp.DlpPublicMatch;
import com.example.backend.entity.Utilisateur;
import com.example.backend.enums.RoleMessage;
import com.example.backend.enums.StatutMessage;
import com.example.backend.repository.AttachmentRepository;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AttachmentServiceTest {

    @TempDir
    private Path storageDir;

    private AttachmentRepository attachmentRepository;
    private DemoUserProvider demoUserProvider;
    private Utilisateur user;
    private AttachmentService attachmentService;

    @BeforeEach
    void setUp() {
        attachmentRepository = mock(AttachmentRepository.class);
        demoUserProvider = mock(DemoUserProvider.class);
        user = mock(Utilisateur.class);
        when(demoUserProvider.currentUser()).thenReturn(user);
        attachmentService = new AttachmentService(attachmentRepository, demoUserProvider, storageDir.toString());
    }

    @Test
    void secureReturnsStoredFileMaskedTextOnly() {
        Attachment attachment = attachment(
                "safe.txt",
                "line one\nsecret sk-test-secret",
                "line one\nsecret [OPENAI_API_KEY_1]",
                ""
        );
        when(attachmentRepository.findOwnedById(42L, user)).thenReturn(Optional.of(attachment));

        AttachmentSecureResponse secure = attachmentService.secure(42L);

        assertThat(secure.attachmentId()).isEqualTo(42L);
        assertThat(secure.maskedText())
                .isEqualTo("line one\nsecret [OPENAI_API_KEY_1]")
                .contains("[OPENAI_API_KEY_1]")
                .doesNotContain("Pieces jointes:");
    }

    @Test
    void inspectionRecalculatesLineNumbersFromOffsetsForMultilineFiles() {
        String extracted = multilineText();
        String matches = String.join("\n",
                matchLine("secrets.log", "email_1", "email", extracted, "admin@example.com", 1, "medium", "[EMAIL_1]"),
                matchLine("secrets.log", "openai_api_key_1", "openai_api_key", extracted, "sk-test-secret", 1, "high", "[OPENAI_API_KEY_1]"),
                matchLine("secrets.log", "moroccan_cin_1", "moroccan_cin", extracted, "AB123456", 1, "high", "[MOROCCAN_CIN_1]")
        );
        Attachment attachment = attachment("secrets.log", extracted, "masked", matches);
        when(attachmentRepository.findOwnedById(42L, user)).thenReturn(Optional.of(attachment));

        AttachmentInspectionResponse inspection = attachmentService.inspection(42L);

        assertThat(inspection.attachmentId()).isEqualTo(42L);
        assertThat(inspection.extractedText()).isEqualTo(extracted);
        assertThat(inspection.matches())
                .extracting("type", "lineNumber", "placeholder")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("email", 3, "[EMAIL_1]"),
                        org.assertj.core.groups.Tuple.tuple("openai_api_key", 8, "[OPENAI_API_KEY_1]"),
                        org.assertj.core.groups.Tuple.tuple("moroccan_cin", 15, "[MOROCCAN_CIN_1]")
                );
    }

    @Test
    void inspectionPreservesStoredMatchesWhenExtractedTextIsMissing() {
        Attachment attachment = attachment("secrets.log", "", "", "secrets.log\temail_1\temail\t0\t18\t1\tmedium\t[EMAIL_1]");
        when(attachmentRepository.findOwnedById(42L, user)).thenReturn(Optional.of(attachment));

        AttachmentInspectionResponse inspection = attachmentService.inspection(42L);

        assertThat(inspection.extractedText()).isEmpty();
        assertThat(inspection.matches())
                .extracting("attachmentId", "source", "type", "start", "end", "lineNumber", "severity")
                .containsExactly(org.assertj.core.groups.Tuple.tuple(42L, "secrets.log", "email", 0, 18, null, "medium"));
    }

    @Test
    void inspectionAssociatesStoredMatchesWithAttachmentIdAndFilename() {
        String extracted = "Email admin@example.com";
        String matches = "stale-source.txt\temail_1\temail\t6\t23\t1\tmedium\t[EMAIL_1]";
        Attachment attachment = attachment("current-name.txt", extracted, "masked", matches);
        when(attachmentRepository.findOwnedById(42L, user)).thenReturn(Optional.of(attachment));

        AttachmentInspectionResponse inspection = attachmentService.inspection(42L);

        assertThat(inspection.matches()).hasSize(1);
        assertThat(inspection.matches().get(0).attachmentId()).isEqualTo(42L);
        assertThat(inspection.matches().get(0).source()).isEqualTo("current-name.txt");
    }

    @Test
    void secureBuildsMaskedTextFromStoredMatchesWhenMissing() {
        String extracted = "Email admin@example.com\nToken sk-test-secret";
        String matches = String.join("\n",
                "secrets.log\temail_1\temail\t6\t23\t1\tmedium\t[EMAIL_1]",
                "secrets.log\topenai_api_key_1\topenai_api_key\t30\t44\t2\thigh\t[OPENAI_API_KEY_1]"
        );
        Attachment attachment = attachment("secrets.log", extracted, "", matches);
        when(attachmentRepository.findOwnedById(42L, user)).thenReturn(Optional.of(attachment));

        AttachmentSecureResponse secure = attachmentService.secure(42L);

        assertThat(secure.maskedText()).isEqualTo("Email [EMAIL_1]\nToken [OPENAI_API_KEY_1]");
    }

    @Test
    void storePersistsExtractedAndMaskedTextForDocumentAttachments() {
        Conversation conversation = new Conversation(user, null, "Conversation");
        setId(conversation, 196L);
        Message message = new Message(conversation, RoleMessage.USER, 1, StatutMessage.TERMINE, "prompt", null);
        setId(message, 950L);
        String extracted = "PDF email admin@example.com";
        String masked = "PDF email [EMAIL_1]";
        MockMultipartFile file = new MockMultipartFile("files", "report.pdf", "application/pdf", "pdf".getBytes(StandardCharsets.UTF_8));
        DlpAttachmentAnalysis analysis = new DlpAttachmentAnalysis(
                "report.pdf",
                "report.pdf",
                "application/pdf",
                file.getSize(),
                "MASK",
                masked.length(),
                5,
                "SUCCESS",
                extracted,
                masked,
                List.of(new DlpPublicMatch(null, "report.pdf", "email_1", "email", 10, 27, 1, "medium", "[EMAIL_1]"))
        );
        when(attachmentRepository.save(org.mockito.ArgumentMatchers.any(Attachment.class)))
                .thenAnswer(invocation -> {
                    Attachment saved = invocation.getArgument(0);
                    setId(saved, 42L);
                    return saved;
                });

        attachmentService.store(message, List.of(file), List.of(analysis));

        ArgumentCaptor<Attachment> captor = ArgumentCaptor.forClass(Attachment.class);
        org.mockito.Mockito.verify(attachmentRepository).save(captor.capture());
        assertThat(captor.getValue().getExtractedText()).isEqualTo(extracted);
        assertThat(captor.getValue().getMaskedText()).isEqualTo(masked);
        assertThat(captor.getValue().getMatchesJson()).contains("report.pdf", "email_1", "medium");
    }

    private Attachment attachment(String filename, String extractedText, String maskedText, String matchesJson) {
        Message message = new Message(null, RoleMessage.USER, 1, StatutMessage.TERMINE, "prompt", null);
        Attachment attachment = new Attachment(
                message,
                filename,
                "conversation/message/" + filename,
                "text/plain",
                extractedText.length(),
                "MASK",
                "SUCCESS",
                extractedText,
                maskedText,
                matchesJson
        );
        setId(attachment, 42L);
        return attachment;
    }

    private String multilineText() {
        return String.join("\n",
                "line 1",
                "line 2",
                "email admin@example.com",
                "line 4",
                "line 5",
                "line 6",
                "line 7",
                "token sk-test-secret",
                "line 9",
                "line 10",
                "line 11",
                "line 12",
                "line 13",
                "line 14",
                "cin AB123456"
        );
    }

    private String matchLine(String source, String id, String type, String text, String value, int staleLineNumber, String severity, String placeholder) {
        int start = text.indexOf(value);
        return source + "\t" + id + "\t" + type + "\t" + start + "\t" + (start + value.length()) + "\t" + staleLineNumber + "\t" + severity + "\t" + placeholder;
    }

    private void setId(Attachment attachment, Long id) {
        setId((Object) attachment, id);
    }

    private void setId(Object entity, Long id) {
        try {
            Field field = entity.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError(exception);
        }
    }
}
