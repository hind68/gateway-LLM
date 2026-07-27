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
import com.example.backend.integration.litellm.LiteLlmMessage;
import com.example.backend.integration.litellm.LiteLlmService;
import com.example.backend.entity.Utilisateur;
import com.example.backend.repository.ConversationRepository;
import com.example.backend.repository.MessageRepository;
import com.example.backend.repository.ModeleLlmRepository;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ConversationService {

    private static final Set<RoleMessage> CONTEXT_ROLES = Set.of(RoleMessage.USER, RoleMessage.ASSISTANT);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ModeleLlmRepository modeleLlmRepository;
    private final DemoUserProvider demoUserProvider;
    private final LiteLlmService liteLlmService;
    private final MessagePersistenceService messagePersistenceService;
    private final DlpService dlpService;
    private final int maxContextMessages;

    public ConversationService(
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            ModeleLlmRepository modeleLlmRepository,
            DemoUserProvider demoUserProvider,
            LiteLlmService liteLlmService,
            MessagePersistenceService messagePersistenceService,
            DlpService dlpService,
            @Value("${gateway.context.max-messages:20}") int maxContextMessages
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.modeleLlmRepository = modeleLlmRepository;
        this.demoUserProvider = demoUserProvider;
        this.liteLlmService = liteLlmService;
        this.messagePersistenceService = messagePersistenceService;
        this.dlpService = dlpService;
        this.maxContextMessages = maxContextMessages;
    }

    @Transactional
    public ConversationResponse create(@Valid CreateConversationRequest request) {
        Utilisateur user = demoUserProvider.currentUser();
        ModeleLlm model = activeModel(request.modelAlias());
        String title = normalizeTitle(request.title(), "Nouvelle conversation");
        Conversation conversation = conversationRepository.save(new Conversation(user, model, title));
        return toConversationResponse(conversation);
    }

    @Transactional(readOnly = true)
    public ConversationPageResponse list(String modelAlias, String search, boolean archived, int page, int size) {
        Utilisateur user = demoUserProvider.currentUser();
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
    public ConversationResponse get(Long id) {
        return toConversationResponse(ownedConversation(id));
    }

    @Transactional
    public ConversationResponse update(Long id, UpdateConversationRequest request) {
        Conversation conversation = ownedConversation(id);
        conversation.rename(normalizeTitle(request.title(), conversation.getTitre()));
        return toConversationResponse(conversation);
    }

    @Transactional
    public ConversationResponse changeModel(Long id, ChangeConversationModelRequest request) {
        Conversation conversation = ownedConversation(id);
        ModeleLlm model = activeModel(request.modelAlias());
        conversation.changeModel(model);
        return toConversationResponse(conversation);
    }

    @Transactional
    public void archive(Long id) {
        Conversation conversation = ownedConversation(id);
        conversation.archive();
    }

    @Transactional
    public ConversationResponse restore(Long id) {
        Conversation conversation = ownedConversation(id);
        conversation.restore();
        return toConversationResponse(conversation);
    }

    @Transactional
    public void deletePermanent(Long id) {
        Conversation conversation = ownedConversation(id);
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
    public List<MessageResponse> messages(Long conversationId) {
        Conversation conversation = ownedConversation(conversationId);
        return messageRepository.findByConversationOrderByOrdreAsc(conversation)
                .stream()
                .map(this::toMessageResponse)
                .toList();
    }

    @Transactional
    public StreamPreparation prepareStream(Long conversationId, SendMessageRequest request) {
        String content = request.content().trim();
        if (content.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Message content must not be blank");
        }

        Conversation conversation = ownedConversation(conversationId);
        if (conversation.getStatut() != StatutConversation.ACTIVE) {
            throw new ResponseStatusException(BAD_REQUEST, "Conversation is archived");
        }

        String userId = conversation.getUtilisateur().getExternalId();

        // DLP check happens here, before anything is persisted - the
        // original code saved `content` (raw) straight to the DB below.
        // hasHighSeverity() blocks outright (nothing gets saved at all);
        // anything else flagged gets masked before it's ever written down.
        DlpService.DlpResult dlp = dlpService.analyse(content, userId);
        if (dlp.hasHighSeverity()) {
            throw new ResponseStatusException(BAD_REQUEST, "Message blocked: contains sensitive data");
        }
        String safeContent = dlp.flagged() ? dlp.maskedText() : content;

        ModeleLlm generationModel = conversation.getModele();
        int nextOrder = messageRepository.findMaxOrdre(conversation) + 1;
        Message userMessage = messageRepository.save(new Message(
                conversation,
                RoleMessage.USER,
                nextOrder,
                StatutMessage.TERMINE,
                safeContent,
                null
        ));

        if ("Nouvelle conversation".equals(conversation.getTitre())) {
            // Uses safeContent too - the auto-generated title is displayed
            // and stored just like the message itself, so it shouldn't
            // carry raw PII either.
            conversation.rename(titleFrom(safeContent));
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

        List<LiteLlmMessage> context = buildContext(conversation);
        return new StreamPreparation(
                generationModel.getAliasInterne(),
                assistantMessage.getId(),
                toMessageResponse(userMessage),
                toMessageResponse(assistantMessage),
                context,
                userId
        );
    }

    @Transactional
    public SseEmitter streamMessage(Long conversationId, SendMessageRequest request) {
        StreamPreparation preparation = prepareStream(conversationId, request);
        SseEmitter emitter = new SseEmitter(0L);
        StringBuilder answer = new StringBuilder();

        trySend(emitter, "message", preparation.userMessage());
        trySend(emitter, "message", preparation.assistantMessage());

        liteLlmService.streamChat(
                preparation.modelAlias(),
                preparation.context(),
                token -> {
                    // Deliberately NOT scanned here: the response isn't
                    // complete until it's complete, so there's no point
                    // at which the full text could be checked before an
                    // individual token has already reached the client.
                    // Only a full-buffering redesign (hold the whole
                    // response, scan it, then send it in one shot instead
                    // of token-by-token) would close that - see the
                    // note on completeAssistantMessage below for what
                    // IS covered.
                    answer.append(token);
                    trySend(emitter, "token", token);
                },
                () -> {
                    // The live stream above already went out unscanned,
                    // but what gets PERSISTED doesn't have to match it -
                    // this masks the stored copy so at least the database
                    // (and anything read from it later, e.g. rebuilding
                    // conversation context for a future message) doesn't
                    // carry raw PII forward. The SSE "done" event below
                    // intentionally still sends the raw answer, matching
                    // what the token stream already showed - masking it
                    // here but not in the tokens above would just look
                    // like a glitch to the user.
                    DlpService.DlpResult dlp = dlpService.analyse(answer.toString(), preparation.userId());
                    String storedAnswer = dlp.flagged() ? dlp.maskedText() : answer.toString();

                    messagePersistenceService.completeAssistantMessage(preparation.assistantMessageId(), storedAnswer);
                    trySend(emitter, "done", new StreamDoneResponse(preparation.assistantMessageId(), answer.toString()));
                    emitter.complete();
                },
                error -> {
                    String fallback = answer.isEmpty() ? "Erreur pendant le streaming LiteLLM." : answer.toString();
                    DlpService.DlpResult dlp = dlpService.analyse(fallback, preparation.userId());
                    String storedFallback = dlp.flagged() ? dlp.maskedText() : fallback;

                    messagePersistenceService.failAssistantMessage(preparation.assistantMessageId(), storedFallback);
                    trySend(emitter, "error", "Erreur pendant le streaming LiteLLM.");
                    emitter.complete();
                }
        );

        return emitter;
    }

    private List<LiteLlmMessage> buildContext(Conversation conversation) {
        List<Message> finishedMessages = messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(
                conversation,
                StatutMessage.TERMINE,
                CONTEXT_ROLES
        );
        int fromIndex = Math.max(0, finishedMessages.size() - maxContextMessages);
        List<LiteLlmMessage> context = new ArrayList<>();
        for (Message message : finishedMessages.subList(fromIndex, finishedMessages.size())) {
            context.add(new LiteLlmMessage(message.getRole().name().toLowerCase(), message.getContenu()));
        }
        return context;
    }

    private Conversation ownedConversation(Long id) {
        return conversationRepository.findOwnedById(id, demoUserProvider.currentUser())
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
            List<LiteLlmMessage> context,
            String userId
    ) {
    }

    public record StreamDoneResponse(
            Long messageId,
            String content
    ) {
    }
}