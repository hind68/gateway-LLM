package com.example.backend.service;

import com.example.backend.dto.AttachmentContentResponse;
import com.example.backend.dto.AttachmentInspectionResponse;
import com.example.backend.dto.AttachmentSecureResponse;
import com.example.backend.entity.Attachment;
import com.example.backend.entity.Conversation;
import com.example.backend.entity.Message;
import com.example.backend.integration.dlp.DlpPublicMatch;
import com.example.backend.repository.AttachmentRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final DemoUserProvider demoUserProvider;
    private final CurrentUserService currentUserService;
    private final Path storageRoot;

    public AttachmentService(
            AttachmentRepository attachmentRepository,
            DemoUserProvider demoUserProvider,
            CurrentUserService currentUserService,
            @Value("${app.attachments.storage-dir:storage/attachments}") String storageDir
    ) {
        this.attachmentRepository = attachmentRepository;
        this.demoUserProvider = demoUserProvider;
        this.currentUserService = currentUserService;
        this.storageRoot = Paths.get(storageDir).toAbsolutePath().normalize();
    }

    @Transactional
    public List<AttachmentMetadata> store(Message message, List<MultipartFile> files, List<DlpAttachmentAnalysis> analyses) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        List<AttachmentMetadata> metadata = new ArrayList<>();
        try {
            Files.createDirectories(storageRoot);
        } catch (IOException exception) {
            throw new UncheckedIOException("Unable to create attachment storage directory", exception);
        }
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            DlpAttachmentAnalysis analysis = findAnalysis(file, analyses);
            String filename = analysis == null ? sanitizeFilename(file.getOriginalFilename()) : analysis.filename();
            String storageKey = message.getConversation().getId() + "/" + message.getId() + "/" + UUID.randomUUID() + "-" + filename;
            Path destination = resolveStorageKey(storageKey);
            try {
                Files.createDirectories(destination.getParent());
                file.transferTo(destination);
            } catch (IOException exception) {
                throw new UncheckedIOException("Unable to store attachment", exception);
            }
            Attachment attachment = attachmentRepository.save(new Attachment(
                    message,
                    filename,
                    storageKey,
                    analysis == null ? safeMimeType(file.getContentType()) : analysis.mimeType(),
                    file.getSize(),
                    analysis == null ? "BLOCK" : analysis.decision(),
                    analysis == null ? "ERROR" : analysis.extractionStatus(),
                    analysis == null ? "" : analysis.extractedText(),
                    analysis == null ? "" : analysis.maskedText(),
                    serializeMatches(analysis == null ? List.of() : analysis.matches())
            ));
            metadata.add(new AttachmentMetadata(
                    attachment.getId(),
                    attachment.getOriginalFilename(),
                    attachment.getMimeType(),
                    attachment.getSize(),
                    attachment.getDlpDecision(),
                    safeCharacters(attachment.getMaskedText()),
                    estimateTokens(safeCharacters(attachment.getMaskedText())),
                    attachment.getExtractionStatus()
            ));
        }
        return metadata;
    }

    @Transactional(readOnly = true)
    public AttachmentContentResponse metadata(Long id) {
        Attachment attachment = ownedAttachment(id);
        return new AttachmentContentResponse(
                attachment.getId(),
                attachment.getOriginalFilename(),
                attachment.getMimeType(),
                attachment.getSize(),
                attachment.getDlpDecision(),
                attachment.getExtractionStatus()
        );
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> originalContent(Long id) {
        Attachment attachment = ownedAttachment(id);
        Path path = resolveStorageKey(attachment.getStorageKey());
        if (!Files.exists(path)) {
            throw new ResponseStatusException(NOT_FOUND, "Attachment file not found");
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getMimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeHeaderFilename(attachment.getOriginalFilename()) + "\"")
                .body(new PathResource(path));
    }

    @Transactional(readOnly = true)
    public AttachmentInspectionResponse inspection(Long id) {
        Attachment attachment = ownedAttachment(id);
        String extractedText = attachment.getExtractedText() == null ? "" : attachment.getExtractedText();
        return new AttachmentInspectionResponse(
                attachment.getId(),
                attachment.getOriginalFilename(),
                attachment.getMimeType(),
                attachment.getExtractionStatus(),
                extractedText,
                responseMatches(attachment.getId(), attachment.getOriginalFilename(), extractedText, parseMatches(attachment.getMatchesJson()))
        );
    }

    @Transactional
    public AttachmentSecureResponse secure(Long id) {
        Attachment attachment = ownedAttachment(id);
        String maskedText = ensureMaskedText(attachment);
        return new AttachmentSecureResponse(
                attachment.getId(),
                attachment.getOriginalFilename(),
                attachment.getMimeType(),
                attachment.getExtractionStatus(),
                maskedText
        );
    }

    @Transactional
    public ResponseEntity<byte[]> secureDownload(Long id) {
        AttachmentSecureResponse secure = secure(id);
        String base = secure.filename().replaceAll("\\.[^.]+$", "");
        String filename = safeHeaderFilename(base + "-securise.txt");
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "plain", java.nio.charset.StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(secure.maskedText().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Transactional
    public void deleteFilesForConversation(Conversation conversation) {
        for (Attachment attachment : attachmentRepository.findByConversation(conversation)) {
            deleteQuietly(resolveStorageKey(attachment.getStorageKey()));
        }
    }

    @Transactional
    public String maskedTextForConversationAttachment(Long attachmentId, Long conversationId) {
        Attachment attachment = ownedAttachment(attachmentId);
        if (!attachment.getMessage().getConversation().getId().equals(conversationId)) {
            throw new ResponseStatusException(NOT_FOUND, "Attachment not found");
        }
        return ensureMaskedText(attachment);
    }

    private Attachment ownedAttachment(Long id) {
        return attachmentRepository.findOwnedById(id, authenticatedUser())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Attachment not found"));
    }

    private com.example.backend.entity.Utilisateur authenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null
                ? null : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof Jwt jwt) {
            return currentUserService.resolve(jwt);
        }
        return demoUserProvider.currentUser();
    }

    private DlpAttachmentAnalysis findAnalysis(MultipartFile file, List<DlpAttachmentAnalysis> analyses) {
        if (analyses == null || analyses.isEmpty()) {
            return null;
        }
        String filename = sanitizeFilename(file.getOriginalFilename());
        return analyses.stream()
                .filter(analysis -> analysis.filename().equals(filename))
                .findFirst()
                .orElse(null);
    }

    private Path resolveStorageKey(String storageKey) {
        Path path = storageRoot.resolve(storageKey).normalize();
        if (!path.startsWith(storageRoot)) {
            throw new ResponseStatusException(NOT_FOUND, "Attachment not found");
        }
        return path;
    }

    private String serializeMatches(List<DlpPublicMatch> matches) {
        if (matches == null || matches.isEmpty()) {
            return "";
        }
        return matches.stream()
                .map(match -> encodeField(match.source()) + "\t"
                        + encodeField(match.id()) + "\t"
                        + encodeField(match.type()) + "\t"
                        + valueOrEmpty(match.start()) + "\t"
                        + valueOrEmpty(match.end()) + "\t"
                        + valueOrEmpty(match.lineNumber()) + "\t"
                        + encodeField(match.severity()) + "\t"
                        + encodeField(match.placeholder()))
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private List<DlpPublicMatch> parseMatches(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split("\\R"))
                .map(this::parseMatch)
                .filter(match -> match != null)
                .toList();
    }

    private DlpPublicMatch parseMatch(String line) {
        String[] parts = line.split("\\t", -1);
        if (parts.length == 6) {
            return new DlpPublicMatch(
                    null,
                    decodeField(parts[0]),
                    null,
                    decodeField(parts[1]),
                    parseInteger(parts[2]),
                    parseInteger(parts[3]),
                    parseInteger(parts[4]),
                    null,
                    decodeField(parts[5])
            );
        }
        if (parts.length != 7) {
            if (parts.length != 8) {
                return null;
            }
            return new DlpPublicMatch(
                    null,
                    decodeField(parts[0]),
                    decodeField(parts[1]),
                    decodeField(parts[2]),
                    parseInteger(parts[3]),
                    parseInteger(parts[4]),
                    parseInteger(parts[5]),
                    decodeField(parts[6]),
                    decodeField(parts[7])
            );
        }
        return new DlpPublicMatch(
                null,
                decodeField(parts[0]),
                null,
                decodeField(parts[1]),
                parseInteger(parts[2]),
                parseInteger(parts[3]),
                parseInteger(parts[4]),
                decodeField(parts[5]),
                decodeField(parts[6])
        );
    }

    private List<DlpPublicMatch> responseMatches(Long attachmentId, String source, String extractedText, List<DlpPublicMatch> matches) {
        if (matches == null || matches.isEmpty()) {
            return List.of();
        }
        String text = extractedText == null ? "" : extractedText;
        return matches.stream()
                .map(match -> new DlpPublicMatch(
                        attachmentId,
                        source,
                        match.id(),
                        match.type(),
                        match.start(),
                        match.end(),
                        safeLineNumber(text, match),
                        match.severity(),
                        match.placeholder()
                ))
                .toList();
    }

    private Integer safeLineNumber(String text, DlpPublicMatch match) {
        if (text != null && !text.isEmpty() && match.start() != null && match.start() >= 0 && match.start() <= text.length()) {
            return lineNumber(text, match.start());
        }
        if (match.lineNumber() != null && match.lineNumber() > 1) {
            return match.lineNumber();
        }
        return null;
    }

    private String ensureMaskedText(Attachment attachment) {
        String maskedText = attachment.getMaskedText() == null ? "" : attachment.getMaskedText();
        if (!maskedText.isBlank()) {
            return maskedText;
        }
        String extractedText = attachment.getExtractedText() == null ? "" : attachment.getExtractedText();
        maskedText = maskFromStoredMatches(extractedText, parseMatches(attachment.getMatchesJson()));
        if (!maskedText.isBlank()) {
            attachment.setMaskedText(maskedText);
            attachmentRepository.save(attachment);
        }
        return maskedText;
    }

    private String maskFromStoredMatches(String extractedText, List<DlpPublicMatch> matches) {
        if (extractedText == null || extractedText.isBlank() || matches == null || matches.isEmpty()) {
            return "";
        }
        StringBuilder masked = new StringBuilder(extractedText);
        matches.stream()
                .filter(match -> match.start() != null && match.end() != null)
                .filter(match -> match.start() >= 0 && match.end() > match.start() && match.end() <= masked.length())
                .sorted(java.util.Comparator.comparing(DlpPublicMatch::start).reversed())
                .forEach(match -> masked.replace(match.start(), match.end(), placeholder(match)));
        return masked.toString();
    }

    private Integer lineNumber(String text, Integer start) {
        if (text == null || start == null || start < 0 || start > text.length()) {
            return null;
        }
        if (start == 0) {
            return 1;
        }
        int boundedStart = Math.min(start, text.length());
        int line = 1;
        for (int i = 0; i < boundedStart; i++) {
            if (text.charAt(i) == '\n') {
                line++;
            }
        }
        return line;
    }

    private String placeholder(DlpPublicMatch match) {
        if (match.placeholder() != null && !match.placeholder().isBlank()) {
            return match.placeholder();
        }
        String id = match.id();
        if (id == null || id.isBlank()) {
            id = match.type() == null || match.type().isBlank() ? "DLP" : match.type();
        }
        return "[" + id.toUpperCase() + "]";
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    private String sanitizeFilename(String value) {
        if (value == null || value.isBlank()) {
            return "attachment";
        }
        String name = Paths.get(value).getFileName().toString();
        String sanitized = name.replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]+", "_").trim();
        if (sanitized.isBlank()) {
            return "attachment";
        }
        return sanitized.length() > 120 ? sanitized.substring(0, 120) : sanitized;
    }

    private String safeMimeType(String value) {
        return value == null || value.isBlank() ? "application/octet-stream" : value;
    }

    private String safeHeaderFilename(String value) {
        return sanitizeFilename(value).replace("\"", "");
    }

    private int safeCharacters(String value) {
        return value == null ? 0 : value.length();
    }

    private int estimateTokens(int characters) {
        return (int) Math.ceil(characters / 4.0);
    }

    private String encodeField(String value) {
        return value == null ? "" : value.replace("%", "%25").replace("\t", "%09").replace("\n", "%0A").replace("\r", "%0D");
    }

    private String decodeField(String value) {
        return value.replace("%0D", "\r").replace("%0A", "\n").replace("%09", "\t").replace("%25", "%");
    }

    private String valueOrEmpty(Integer value) {
        return value == null ? "" : String.valueOf(value);
    }

    private Integer parseInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
