package com.example.backend.service;

import com.example.backend.dto.ChangeConversationModelRequest;
import com.example.backend.dto.ConversationPageResponse;
import com.example.backend.dto.ConversationResponse;
import com.example.backend.dto.CreateConversationRequest;
import com.example.backend.dto.MessageResponse;
import com.example.backend.dto.SendMessageRequest;
import com.example.backend.dto.UpdateConversationRequest;
import com.example.backend.entity.Conversation;
import com.example.backend.entity.Message;
import com.example.backend.entity.ModeleLlm;
import com.example.backend.enums.RoleMessage;
import com.example.backend.enums.StatutConversation;
import com.example.backend.enums.StatutMessage;
import com.example.backend.enums.StatutModeleLlm;
import com.example.backend.exceptions.DlpAnalysisException;
import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.exceptions.DlpUnavailableException;
import com.example.backend.integration.litellm.LiteLlmMessage;
import com.example.backend.integration.litellm.LiteLlmService;
import com.example.backend.entity.Utilisateur;
import com.example.backend.repository.ConversationRepository;
import com.example.backend.repository.MessageRepository;
import com.example.backend.repository.ModeleLlmRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ConversationService {

    private static final Set<RoleMessage> CONTEXT_ROLES = Set.of(RoleMessage.USER, RoleMessage.ASSISTANT);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ModeleLlmRepository modeleLlmRepository;
    private final CurrentUserService currentUserService;
    private final LiteLlmService liteLlmService;
    private final DlpService dlpService;
    private final MessagePersistenceService messagePersistenceService;
    private final ChatValidationService chatValidationService;
    private final AttachmentService attachmentService;
    private final int maxContextMessages;

    @Autowired
    public ConversationService(
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            ModeleLlmRepository modeleLlmRepository,
            CurrentUserService currentUserService,
            LiteLlmService liteLlmService,
            DlpService dlpService,
            MessagePersistenceService messagePersistenceService,
            ChatValidationService chatValidationService,
            AttachmentService attachmentService,
            @Value("${gateway.context.max-messages:20}") int maxContextMessages
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.modeleLlmRepository = modeleLlmRepository;
        this.currentUserService = currentUserService;
        this.liteLlmService = liteLlmService;
        this.dlpService = dlpService;
        this.messagePersistenceService = messagePersistenceService;
        this.chatValidationService = chatValidationService;
        this.attachmentService = attachmentService;
        this.maxContextMessages = maxContextMessages;
    }

    /** Backward-compatible constructor retained for existing unit tests and integrations. */
    public ConversationService(
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            ModeleLlmRepository modeleLlmRepository,
            CurrentUserService currentUserService,
            LiteLlmService liteLlmService,
            DlpService dlpService,
            MessagePersistenceService messagePersistenceService,
            ChatValidationService chatValidationService,
            int maxContextMessages
    ) {
        this(conversationRepository, messageRepository, modeleLlmRepository, currentUserService,
                liteLlmService, dlpService, messagePersistenceService, chatValidationService,
                null, maxContextMessages);
    }

    @Transactional
    public ConversationResponse create(@Valid CreateConversationRequest request, Jwt jwt) {
        Utilisateur user = currentUserService.resolve(jwt);
        ModeleLlm model = activeModel(request.modelAlias());
        String title = normalizeTitle(request.title(), "Nouvelle conversation");
        Conversation conversation = conversationRepository.save(new Conversation(user, model, title));
        return toConversationResponse(conversation);
    }

    @Transactional(readOnly = true)
    public ConversationPageResponse list(String modelAlias, String search, boolean archived, int page, int size, Jwt jwt) {
        Utilisateur user = currentUserService.resolve(jwt);
        StatutConversation status = archived ? StatutConversation.ARCHIVEE : StatutConversation.ACTIVE;
        PageRequest pageRequest = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "dernierMessageAt")
        );
        Page<ConversationResponse> result = conversationRepository.search(
                user,
                status,
                blankToNull(modelAlias),
                searchPattern(search),
                pageRequest
        ).map(this::toConversationResponse);
        return new ConversationPageResponse(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public ConversationResponse get(Long id, Jwt jwt) {
        return toConversationResponse(ownedConversation(id, jwt));
    }

    @Transactional
    public ConversationResponse update(Long id, UpdateConversationRequest request, Jwt jwt) {
        Conversation conversation = ownedConversation(id, jwt);
        conversation.rename(normalizeTitle(request.title(), conversation.getTitre()));
        return toConversationResponse(conversation);
    }

    @Transactional
    public ConversationResponse changeModel(Long id, ChangeConversationModelRequest request, Jwt jwt) {
        Conversation conversation = ownedConversation(id, jwt);
        ModeleLlm model = activeModel(request.modelAlias());
        conversation.changeModel(model);
        return toConversationResponse(conversation);
    }

    @Transactional
    public void archive(Long id, Jwt jwt) {
        ownedConversation(id, jwt).archive();
    }

    @Transactional
    public ConversationResponse restore(Long id, Jwt jwt) {
        Conversation conversation = ownedConversation(id, jwt);
        conversation.restore();
        return toConversationResponse(conversation);
    }

    @Transactional
    public void deletePermanent(Long id, Jwt jwt) {
        Conversation conversation = ownedConversation(id, jwt);
        Long conversationId = id;
        Utilisateur user = conversation.getUtilisateur();
        messageRepository.clearResponseLinksByConversationId(conversationId);
        messageRepository.deleteAllByConversationId(conversationId);
        messageRepository.flush();
        int deleted = conversationRepository.deleteOwnedById(conversationId, user);
        if (deleted == 0) {
            throw new ResponseStatusException(NOT_FOUND, "Conversation not found");
        }
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(Long conversationId, Jwt jwt) {
        Conversation conversation = ownedConversation(conversationId, jwt);
        return messageRepository.findByConversationOrderByOrdreAsc(conversation)
                .stream().map(this::toMessageResponse).toList();
    }

    @Transactional
    public StreamPreparation prepareStream(Long conversationId, SendMessageRequest request, Jwt jwt) {
        String content = request.content().trim();
        if (content.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Message content must not be blank");
        }

        UUID userId = currentUserService.keycloakId(jwt);

        Conversation conversation = ownedConversation(conversationId, jwt);
        if (conversation.getStatut() != StatutConversation.ACTIVE) {
            throw new ResponseStatusException(BAD_REQUEST, "Conversation is archived");
        }

        ModeleLlm generationModel = conversation.getModele();
        Utilisateur user = conversation.getUtilisateur();
        List<String> roles = currentUserService.roles(jwt);
        chatValidationService.validateLlmAccess(userId, generationModel.getAliasInterne(), roles);
        List<String> bannedWords = chatValidationService.getBannedWords(userId, roles);

        String safeContent = dlpService.safeUserMessage(content, userId, user.getExternalId(), bannedWords);

        int nextOrder = messageRepository.findMaxOrdre(conversation) + 1;
        Message userMessage = messageRepository.save(new Message(
                conversation,
                RoleMessage.USER,
                nextOrder,
                StatutMessage.TERMINE,
                content,
                null
        ));

        if ("Nouvelle conversation".equals(conversation.getTitre())) {
            conversation.rename(titleFrom(content));
        }

        Message assistantMessage = messageRepository.save(new Message(
                conversation,
                RoleMessage.ASSISTANT,
                nextOrder + 1,
                StatutMessage.EN_COURS,
                "",
                userMessage,
                generationModel
        ));
        conversation.touchLastMessageAt(Instant.now());

        List<LiteLlmMessage> context = buildContext(conversation, userMessage, safeContent, bannedWords);
        return new StreamPreparation(
                generationModel.getAliasInterne(),
                assistantMessage.getId(),
                toMessageResponse(userMessage),
                toMessageResponse(assistantMessage),
                context
        );
    }

    @Transactional
    public SseEmitter streamMessage(Long conversationId, SendMessageRequest request, Jwt jwt) {
        SseEmitter emitter = new SseEmitter(0L);
        StreamPreparation preparation;
        try {
            preparation = prepareStream(conversationId, request, jwt);
        } catch (DlpAnalysisException exception) {
            trySend(emitter, "error", streamError(exception));
            emitter.complete();
            return emitter;
        }

        StringBuilder answer = new StringBuilder();

        trySend(emitter, "message", preparation.userMessage());
        trySend(emitter, "message", preparation.assistantMessage());

        liteLlmService.streamChat(
                preparation.modelAlias(),
                preparation.context(),
                token -> {
                    answer.append(token);
                    trySend(emitter, "token", token);
                },
                () -> {
                    messagePersistenceService.completeAssistantMessage(preparation.assistantMessageId(), answer.toString());
                    trySend(emitter, "done", new StreamDoneResponse(preparation.assistantMessageId(), answer.toString()));
                    emitter.complete();
                },
                error -> {
                    String fallback = answer.isEmpty() ? "Erreur pendant le streaming LiteLLM." : answer.toString();
                    messagePersistenceService.failAssistantMessage(preparation.assistantMessageId(), fallback);
                    trySend(emitter, "error", "Erreur pendant le streaming LiteLLM.");
                    emitter.complete();
                }
        );

        return emitter;
    }

    public SseEmitter streamMessageWithFiles(Long conversationId, String content, List<MultipartFile> files, Jwt jwt) {
        SseEmitter emitter = new SseEmitter(0L);
        try {
            Conversation conversation = ownedConversation(conversationId, jwt);
            UUID userId = currentUserService.keycloakId(jwt);
            Utilisateur authenticatedUser = currentUserService.resolve(jwt);
            List<String> bannedWords = chatValidationService.getBannedWords(userId, currentUserService.roles(jwt));
            List<DlpAttachmentAnalysis> analyses = files == null ? List.of() : files.stream()
                    .filter(file -> file != null && !file.isEmpty())
                    .map(file -> dlpService.analyseAttachment(file, userId, authenticatedUser.getExternalId(), bannedWords))
                    .toList();
            StringBuilder prompt = new StringBuilder(content == null ? "" : content);
            for (DlpAttachmentAnalysis analysis : analyses) {
                prompt.append("\n\n[Fichier: ").append(analysis.filename()).append("]\n")
                        .append(analysis.maskedText() == null ? "" : analysis.maskedText());
            }
            StreamPreparation preparation = prepareStream(conversationId, new SendMessageRequest(prompt.toString()), jwt);
            Message userMessage = messageRepository.findById(preparation.userMessage().id()).orElseThrow();
            List<AttachmentMetadata> attachments = attachmentService.store(userMessage, files, analyses);
            userMessage.setAttachmentMetadataJson(serializeAttachmentMetadata(attachments));
            MessageResponse userResponse = withAttachments(preparation.userMessage(), attachments);
            trySend(emitter, "message", userResponse);
            trySend(emitter, "message", preparation.assistantMessage());
            streamPrepared(emitter, preparation);
        } catch (DlpAnalysisException exception) {
            trySend(emitter, "error", streamError(exception));
            emitter.complete();
        } catch (RuntimeException exception) {
            trySend(emitter, "error", exception.getMessage() == null ? "File processing failed" : exception.getMessage());
            emitter.complete();
        }
        return emitter;
    }

    private void streamPrepared(SseEmitter emitter, StreamPreparation preparation) {
        StringBuilder answer = new StringBuilder();
        liteLlmService.streamChat(preparation.modelAlias(), preparation.context(), token -> {
            answer.append(token);
            trySend(emitter, "token", token);
        }, () -> {
            messagePersistenceService.completeAssistantMessage(preparation.assistantMessageId(), answer.toString());
            trySend(emitter, "done", new StreamDoneResponse(preparation.assistantMessageId(), answer.toString()));
            emitter.complete();
        }, error -> {
            String fallback = answer.isEmpty() ? "Erreur pendant le streaming LiteLLM." : answer.toString();
            messagePersistenceService.failAssistantMessage(preparation.assistantMessageId(), fallback);
            trySend(emitter, "error", "Erreur pendant le streaming LiteLLM.");
            emitter.complete();
        });
    }

    private MessageResponse withAttachments(MessageResponse message, List<AttachmentMetadata> attachments) {
        return new MessageResponse(message.id(), message.role(), message.order(), message.status(), message.content(),
                message.responseToMessageId(), message.modelAlias(), message.modelDisplayName(), message.dlpHighestSeverity(),
                message.dlpDetectedTypes(), message.dlpMatches(), message.dlpMaskedText(), attachments,
                message.createdAt(), message.updatedAt());
    }

    private String serializeAttachmentMetadata(List<AttachmentMetadata> attachments) {
        return attachments == null ? "" : attachments.stream().map(item -> item.id() + "\t" + item.filename() + "\t" + item.mimeType() + "\t" + item.size() + "\t" + item.decision() + "\t" + item.safeCharacters() + "\t" + item.estimatedTokens() + "\t" + item.extractionStatus()).collect(java.util.stream.Collectors.joining("\n"));
    }

    @Transactional(readOnly = true)
    public SseEmitter streamSecureAttachment(Long conversationId, Long attachmentId) {
        SseEmitter emitter = new SseEmitter(0L);
        try {
            String maskedText = attachmentService.maskedTextForConversationAttachment(attachmentId, conversationId);
            if (maskedText == null || maskedText.isBlank()) {
                throw new ResponseStatusException(BAD_REQUEST, "Secure attachment content is empty");
            }
            trySend(emitter, "token", maskedText);
            trySend(emitter, "done", maskedText);
        } catch (RuntimeException exception) {
            trySend(emitter, "error", exception.getMessage());
        }
        emitter.complete();
        return emitter;
    }

    private List<LiteLlmMessage> buildContext(Conversation conversation, Message safeMessage, String safeContent, List<String> bannedWords) {
        List<Message> finishedMessages = messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(
                conversation,
                StatutMessage.TERMINE,
                CONTEXT_ROLES
        );
        int fromIndex = Math.max(0, finishedMessages.size() - maxContextMessages);
        List<LiteLlmMessage> context = new ArrayList<>();
        for (Message message : finishedMessages.subList(fromIndex, finishedMessages.size())) {
            String content = safeContextContent(message, safeMessage, safeContent, bannedWords);
            context.add(new LiteLlmMessage(message.getRole().name().toLowerCase(), content));
        }
        return context;
    }

    private String safeContextContent(Message message, Message currentUserMessage, String currentSafeContent, List<String> bannedWords) {
        if (isSameMessage(message, currentUserMessage)) {
            return currentSafeContent;
        }
        return dlpService.safeTextForLlm(message.getContenu(), message.getConversation().getUtilisateur().getExternalId(), bannedWords);
    }

    private boolean isSameMessage(Message candidate, Message reference) {
        if (candidate == reference) {
            return true;
        }
        return candidate.getId() != null && candidate.getId().equals(reference.getId());
    }

    private Conversation ownedConversation(Long id, Jwt jwt) {
        return conversationRepository.findOwnedById(id, currentUserService.resolve(jwt))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Conversation not found"));
    }

    private ModeleLlm activeModel(String modelAlias) {
        return modeleLlmRepository.findByAliasInterneAndStatut(modelAlias, StatutModeleLlm.ACTIF)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown or inactive model: " + modelAlias));
    }

    private ConversationResponse toConversationResponse(Conversation conversation) {
        return new ConversationResponse(
                conversation.getId(),
                conversation.getTitre(),
                conversation.getModele().getAliasInterne(),
                conversation.getModele().getNomAffichage(),
                conversation.getStatut().name(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt(),
                conversation.getDernierMessageAt()
        );
    }

    private MessageResponse toMessageResponse(Message message) {
        Long responseToId = message.getReponseA() == null ? null : message.getReponseA().getId();
        String modelAlias = message.getModele() == null ? null : message.getModele().getAliasInterne();
        String modelDisplayName = message.getModele() == null ? null : message.getModele().getNomAffichage();
        return new MessageResponse(
                message.getId(),
                message.getRole().name(),
                message.getOrdre(),
                message.getStatut().name(),
                message.getContenu(),
                responseToId,
                modelAlias,
                modelDisplayName,
                message.getDlpHighestSeverity(),
                List.of(),
                List.of(),
                message.getDlpMaskedText(),
                List.of(),
                message.getCreatedAt(),
                message.getUpdatedAt()
        );
    }

    private void trySend(SseEmitter emitter, String event, Object value) {
        try {
            emitter.send(SseEmitter.event().name(event).data(value));
        } catch (IOException ignored) {
            emitter.complete();
        }
    }

    private StreamErrorResponse streamError(DlpAnalysisException exception) {
        if (exception instanceof DlpBlockedException blockedException) {
            return new StreamErrorResponse(
                    "DLP_BLOCKED",
                    "Votre message contient une donnée sensible et ne peut pas être envoyé.",
                    blockedException.getDetectedTypes(),
                    blockedException.getHighestSeverity()
            );
        }
        if (exception instanceof DlpUnavailableException) {
            return new StreamErrorResponse(
                    "DLP_UNAVAILABLE",
                    "Le controle de securite est indisponible. Le message n'a pas ete envoye au modele.",
                    Set.of(),
                    null
            );
        }
        return new StreamErrorResponse(
                "DLP_ERROR",
                "Le controle de securite n'a pas pu analyser le message. Le message n'a pas ete envoye au modele.",
                Set.of(),
                null
        );
    }

    private String normalizeTitle(String title, String fallback) {
        String value = title == null || title.isBlank() ? fallback : title.trim();
        return value.length() > 160 ? value.substring(0, 160) : value;
    }

    private String titleFrom(String content) {
        String compact = content.replaceAll("\\s+", " ").trim();
        String[] words = compact.split("\\s+");
        List<String> meaningfulWords = new ArrayList<>();
        for (String word : words) {
            String cleaned = word.replaceAll("[^\\p{L}\\p{N}]", "");
            if (cleaned.length() >= 4) {
                meaningfulWords.add(cleaned);
            }
            if (meaningfulWords.size() == 6) {
                break;
            }
        }
        if (!meaningfulWords.isEmpty()) {
            return "Discussion: " + String.join(" ", meaningfulWords);
        }
        if (compact.length() <= 48) {
            return "Discussion: " + compact;
        }
        return "Discussion: " + compact.substring(0, 45) + "...";
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String searchPattern(String value) {
        String normalized = blankToNull(value);
        return normalized == null ? null : "%" + normalized.toLowerCase() + "%";
    }

    public record StreamPreparation(
            String modelAlias,
            Long assistantMessageId,
            MessageResponse userMessage,
            MessageResponse assistantMessage,
            List<LiteLlmMessage> context
    ) {
    }

    public record StreamDoneResponse(
            Long messageId,
            String content
    ) {
    }

    public record StreamErrorResponse(
            String code,
            String message,
            Set<String> detectedTypes,
            String highestSeverity
    ) {
    }
}
