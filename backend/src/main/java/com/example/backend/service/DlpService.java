package com.example.backend.service;

import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.exceptions.DlpInvalidResponseException;
import com.example.backend.exceptions.DlpUnavailableException;
import com.example.backend.integration.dlp.DlpAnalysisResponse;
import com.example.backend.integration.dlp.DlpClient;
import com.example.backend.integration.dlp.DlpDecision;
import com.example.backend.integration.dlp.DlpMatch;
import com.example.backend.integration.dlp.DlpMultiSourceAnalysisResponse;
import com.example.backend.integration.dlp.DlpPublicMatch;
import com.example.backend.integration.dlp.DlpSourceResult;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DlpService {
    private static final String SUCCESS_STATUS = "SUCCESS";
    private final DlpClient dlpClient;
    private final FilteredMessageAuditWriter auditWriter;
    @Value("${app.attachments.max-llm-characters:40000}")
    private int maxLlmCharacters = 40_000;

    public DlpService(DlpClient dlpClient, FilteredMessageAuditWriter auditWriter) {
        this.dlpClient = dlpClient;
        this.auditWriter = auditWriter;
    }

    public String safeTextForLlm(String text, String userId, List<String> bannedWords) {
        DlpAnalysisResponse response = dlpClient.analyse(text, userId, bannedWords);
        validateResponse(response);
        if (response.decision() == DlpDecision.BLOCK) throw new DlpBlockedException(response.highestSeverity(), detectedTypes(response));
        if (response.maskedText() == null) throw new DlpInvalidResponseException("DLP response did not include masked_text");
        return response.maskedText();
    }

    public String safeUserMessage(String text, UUID userKeycloakId, String dlpUserId, List<String> bannedWords) {
        DlpAnalysisResponse response = dlpClient.analyse(text, dlpUserId, bannedWords);
        validateResponse(response);
        if (response.decision() == DlpDecision.BLOCK) {
            auditWriter.recordBlocked(userKeycloakId, text, reasonFrom(response), response);
            throw new DlpBlockedException(response.highestSeverity(), detectedTypes(response));
        }
        if (response.maskedText() == null) throw new DlpInvalidResponseException("DLP response did not include masked_text");
        if (response.decision() == DlpDecision.MASK) auditWriter.recordRedacted(userKeycloakId, text, response.maskedText(), reasonFrom(response), response);
        return response.maskedText();
    }

    public DlpSafeMessage safeMessageForLlm(String text, List<MultipartFile> files, UUID userKeycloakId, String userId, List<String> bannedWords) {
        String normalized = text == null ? "" : text.trim();
        List<MultipartFile> safeFiles = files == null ? List.of() : files.stream().filter(file -> file != null && !file.isEmpty()).toList();
        if (normalized.isBlank() && safeFiles.isEmpty()) throw new DlpInvalidResponseException("Message text or attachments are required");
        DlpMultiSourceAnalysisResponse response = dlpClient.analyseMessage(normalized, safeFiles, userId, bannedWords);
        validateMultiSourceResponse(response);
        if (!SUCCESS_STATUS.equalsIgnoreCase(response.status())) {
            throw new DlpUnavailableException(sourceError(response));
        }
        DlpSourceResult failedSource = response.results().stream()
                .filter(result -> !SUCCESS_STATUS.equalsIgnoreCase(result.status()))
                .findFirst()
                .orElse(null);
        if (failedSource != null) {
            throw new DlpUnavailableException(sourceError(failedSource));
        }
        List<DlpAttachmentAnalysis> attachments = attachmentAnalyses(response, safeFiles);
        String safeMessage = sourceText(response, "message");
        if (response.decision() == DlpDecision.BLOCK) {
            throw new DlpBlockedException(response.highestSeverity(), detectedTypes(response), safeMessage, publicMatches(response, attachments), attachments);
        }
        String safePrompt = buildSafePrompt(safeMessage, response.results());
        if (attachments.stream().mapToInt(DlpAttachmentAnalysis::safeCharacters).sum() > maxLlmCharacters) {
            throw new DlpInvalidResponseException("Attachments are too long for the model");
        }
        return new DlpSafeMessage(safePrompt, normalized.isBlank() ? attachmentSummary(attachments) : safeMessage, response.highestSeverity(), attachments);
    }

    private void validateResponse(DlpAnalysisResponse response) {
        if (response == null || response.status() == null || response.decision() == null) throw new DlpInvalidResponseException("DLP response is incomplete");
        if (!SUCCESS_STATUS.equalsIgnoreCase(response.status())) throw new DlpUnavailableException("DLP analysis did not complete successfully");
    }
    private void validateMultiSourceResponse(DlpMultiSourceAnalysisResponse response) {
        if (response == null || response.status() == null || response.decision() == null || response.results() == null) throw new DlpInvalidResponseException("DLP response is incomplete");
        for (DlpSourceResult result : response.results()) if (result == null || result.source() == null || result.status() == null || result.decision() == null || (result.decision() != DlpDecision.BLOCK && result.maskedText() == null)) throw new DlpInvalidResponseException("DLP source response is incomplete");
    }
    private Set<String> detectedTypes(DlpAnalysisResponse response) { return response.matches() == null ? Set.of() : response.matches().stream().map(DlpMatch::type).filter(type -> type != null && !type.isBlank()).collect(Collectors.toUnmodifiableSet()); }
    private Set<String> detectedTypes(DlpMultiSourceAnalysisResponse response) { return response.results().stream().flatMap(result -> result.matches() == null ? java.util.stream.Stream.empty() : result.matches().stream()).map(DlpMatch::type).filter(type -> type != null && !type.isBlank()).collect(Collectors.toSet()); }
    private String reasonFrom(DlpAnalysisResponse response) { Set<String> types = detectedTypes(response); return types.isEmpty() ? "policy_match" : String.join(",", types); }
    private String sourceError(DlpMultiSourceAnalysisResponse response) {
        return response.errors() == null || response.errors().isEmpty()
                ? "DLP could not process the uploaded file"
                : sourceError(response.errors().get(0).code(), response.errors().get(0).message());
    }
    private String sourceError(DlpSourceResult source) {
        if (source.errors() == null || source.errors().isEmpty()) return "DLP could not process " + source.source();
        return sourceError(source.errors().get(0).code(), source.errors().get(0).message());
    }
    private String sourceError(String code, String message) {
        return "DLP file processing failed" + (code == null || code.isBlank() ? "" : " [" + code + "]")
                + (message == null || message.isBlank() ? "" : ": " + message);
    }

    private List<DlpAttachmentAnalysis> attachmentAnalyses(DlpMultiSourceAnalysisResponse response, List<MultipartFile> files) {
        List<DlpAttachmentAnalysis> values = new ArrayList<>();
        for (int index = 0; index < files.size(); index++) {
            MultipartFile file = files.get(index);
            String filename = sanitize(file.getOriginalFilename());
            DlpSourceResult result = attachmentResult(response, filename, index);
            String extracted = result == null || result.extractedText() == null ? "" : result.extractedText();
            String masked = result == null || result.maskedText() == null ? "" : result.maskedText();
            List<DlpPublicMatch> matches = result == null || result.matches() == null ? List.of() : result.matches().stream().map(match -> publicMatch(null, filename, match)).toList();
            values.add(new DlpAttachmentAnalysis(filename, filename, file.getContentType() == null ? "application/octet-stream" : file.getContentType(), file.getSize(), result == null ? "BLOCK" : result.decision().name(), masked.length(), (int) Math.ceil(masked.length() / 4.0), result == null ? "ERROR" : result.status(), extracted, masked, matches));
        }
        return values;
    }
    private DlpSourceResult attachmentResult(DlpMultiSourceAnalysisResponse response, String filename, int index) {
        List<DlpSourceResult> attachmentResults = response.results().stream().filter(item -> !"message".equals(item.source())).toList();
        return attachmentResults.stream()
                .filter(item -> sanitize(sourceFilename(item.source())).equals(filename))
                .findFirst()
                .orElse(index >= 0 && index < attachmentResults.size() ? attachmentResults.get(index) : null);
    }
    private List<DlpPublicMatch> publicMatches(DlpMultiSourceAnalysisResponse response, List<DlpAttachmentAnalysis> attachments) {
        List<DlpPublicMatch> matches = new ArrayList<>();
        response.results().stream()
                .filter(result -> "message".equals(result.source()) && result.matches() != null)
                .flatMap(result -> result.matches().stream())
                .map(match -> publicMatch(null, "message", match))
                .forEach(matches::add);
        attachments.stream()
                .filter(attachment -> attachment.matches() != null)
                .flatMap(attachment -> attachment.matches().stream())
                .forEach(matches::add);
        return matches;
    }
    private DlpPublicMatch publicMatch(Long attachmentId, String source, DlpMatch match) { return new DlpPublicMatch(attachmentId, source, match.id(), match.type(), match.start(), match.end(), null, match.severity(), null); }
    private String sourceText(DlpMultiSourceAnalysisResponse response, String source) { return response.results().stream().filter(result -> source.equals(result.source())).map(DlpSourceResult::maskedText).filter(value -> value != null).findFirst().orElse(""); }
    private String buildSafePrompt(String message, List<DlpSourceResult> results) { StringBuilder prompt = new StringBuilder(message == null ? "" : message); for (DlpSourceResult result : results) if (!"message".equals(result.source()) && result.maskedText() != null && !result.maskedText().isBlank()) prompt.append("\n\n[Fichier: ").append(sanitize(result.source())).append("]\n").append(result.maskedText()); return prompt.toString(); }
    private String attachmentSummary(List<DlpAttachmentAnalysis> attachments) { return attachments.stream().map(DlpAttachmentAnalysis::filename).collect(Collectors.joining(", ", "Pieces jointes: ", "")); }
    private String sourceFilename(String value) {
        if (value == null) return null;
        int separator = Math.max(value.lastIndexOf(':'), value.lastIndexOf('/'));
        return separator >= 0 && separator + 1 < value.length() ? value.substring(separator + 1) : value;
    }
    private String sanitize(String value) { if (value == null || value.isBlank()) return "attachment"; return Paths.get(value).getFileName().toString().replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]+", "_"); }
}
