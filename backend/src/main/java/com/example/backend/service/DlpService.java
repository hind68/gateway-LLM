package com.example.backend.service;

import com.example.backend.integration.dlp.DlpAnalysisResponse;
import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.integration.dlp.DlpClient;
import com.example.backend.integration.dlp.DlpDecision;
import com.example.backend.exceptions.DlpInvalidResponseException;
import com.example.backend.integration.dlp.DlpMatch;
import com.example.backend.exceptions.DlpUnavailableException;
import java.util.List;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.web.multipart.MultipartFile;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class DlpService {

    private static final String SUCCESS_STATUS = "SUCCESS";

    private final DlpClient dlpClient;
    private final FilteredMessageAuditWriter auditWriter;

    public DlpService(DlpClient dlpClient, FilteredMessageAuditWriter auditWriter) {
        this.dlpClient = dlpClient;
        this.auditWriter = auditWriter;
    }

    public String safeTextForLlm(String text, String userId, List<String> bannedWords) {
        DlpAnalysisResponse response = dlpClient.analyse(text, userId, bannedWords);
        validateResponse(response);

        if (response.decision() == DlpDecision.BLOCK) {
            throw new DlpBlockedException(response.highestSeverity(), detectedTypes(response));
        }

        if (response.maskedText() == null) {
            throw new DlpInvalidResponseException("DLP response did not include masked_text");
        }

        return response.maskedText();
    }

    private void validateResponse(DlpAnalysisResponse response) {
        if (response == null || response.status() == null || response.decision() == null) {
            throw new DlpInvalidResponseException("DLP response is incomplete");
        }
        if (!SUCCESS_STATUS.equalsIgnoreCase(response.status())) {
            throw new DlpUnavailableException("DLP analysis did not complete successfully");
        }
    }

    private Set<String> detectedTypes(DlpAnalysisResponse response) {
        if (response.matches() == null) {
            return Set.of();
        }
        return response.matches().stream()
                .map(DlpMatch::type)
                .filter(type -> type != null && !type.isBlank())
                .collect(Collectors.toUnmodifiableSet());
    }
    public String safeUserMessage(String text, UUID userKeycloakId, String dlpUserId, List<String> bannedWords) {
        DlpAnalysisResponse response = dlpClient.analyse(text, dlpUserId, bannedWords);
        validateResponse(response);

        if (response.decision() == DlpDecision.BLOCK) {
            auditWriter.recordBlocked(userKeycloakId, text, reasonFrom(response), response);
            throw new DlpBlockedException(response.highestSeverity(), detectedTypes(response));
        }

        if (response.maskedText() == null) {
            throw new DlpInvalidResponseException("DLP response did not include masked_text");
        }

        if (response.decision() == DlpDecision.MASK) {
            auditWriter.recordRedacted(userKeycloakId, text, response.maskedText(), reasonFrom(response), response);
        }

        return response.maskedText();
    }

    public DlpAttachmentAnalysis analyseAttachment(MultipartFile file, UUID userKeycloakId, String dlpUserId, List<String> bannedWords) {
        String filename = file == null || file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename();
        String text;
        try {
            text = file == null ? "" : new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            return new DlpAttachmentAnalysis(filename, filename, file == null ? "application/octet-stream" : file.getContentType(),
                    file == null ? 0 : file.getSize(), "BLOCK", 0, 0, "ERROR", "", "", List.of());
        }
        DlpAnalysisResponse response = dlpClient.analyse(text, dlpUserId, bannedWords);
        validateResponse(response);
        if (response.decision() == DlpDecision.BLOCK) {
            auditWriter.recordBlocked(userKeycloakId, text, reasonFrom(response), response);
            throw new DlpBlockedException(response.highestSeverity(), detectedTypes(response));
        }
        String masked = response.maskedText() == null ? text : response.maskedText();
        List<com.example.backend.integration.dlp.DlpPublicMatch> matches = response.matches() == null ? List.of() : response.matches().stream()
                .map(match -> new com.example.backend.integration.dlp.DlpPublicMatch(null, filename, match.id(), match.type(), match.start(), match.end(), null, match.severity(), null))
                .toList();
        return new DlpAttachmentAnalysis(filename, filename,
                file == null || file.getContentType() == null ? "application/octet-stream" : file.getContentType(),
                file == null ? 0 : file.getSize(), response.decision().name(), masked.length(), (int) Math.ceil(masked.length() / 4.0),
                "SUCCESS", text, masked, matches);
    }
    private String reasonFrom(DlpAnalysisResponse response) {
        Set<String> types = detectedTypes(response);
        return types.isEmpty() ? "policy_match" : String.join(",", types);
    }
}
