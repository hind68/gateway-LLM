package com.example.backend.service;

import com.example.backend.dto.ChangeConversationModelRequest;
import com.example.backend.dto.CreateConversationRequest;
import com.example.backend.dto.SendMessageRequest;
import com.example.backend.entity.Conversation;
import com.example.backend.entity.FournisseurLlm;
import com.example.backend.entity.Message;
import com.example.backend.entity.ModeleLlm;
import com.example.backend.enums.RoleMessage;
import com.example.backend.enums.StatutFournisseurLlm;
import com.example.backend.enums.StatutMessage;
import com.example.backend.enums.StatutModeleLlm;
import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.exceptions.DlpUnavailableException;
import com.example.backend.integration.litellm.LiteLlmMessage;
import com.example.backend.integration.litellm.LiteLlmService;
import com.example.backend.entity.Utilisateur;
import com.example.backend.repository.ConversationRepository;
import com.example.backend.repository.MessageRepository;
import com.example.backend.repository.ModeleLlmRepository;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ModeleLlmRepository modeleLlmRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private LiteLlmService liteLlmService;

    @Mock
    private DlpService dlpService;

    @Mock
    private MessagePersistenceService messagePersistenceService;

    @Mock
    private ChatValidationService chatValidationService;

    @Mock
    private Utilisateur demoUser;

    @Mock
    private Utilisateur otherUser;

    private ConversationService service;
    private ModeleLlm model;
    private ModeleLlm geminiModel;
    private Conversation conversation;

    private final UUID testUserId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
    private final Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(testUserId.toString())
            .build();

    @BeforeEach
    void setUp() {
        FournisseurLlm fournisseur = new FournisseurLlm("groq", "Groq", StatutFournisseurLlm.ACTIF);
        FournisseurLlm gemini = new FournisseurLlm("gemini", "Google Gemini", StatutFournisseurLlm.ACTIF);
        model = new ModeleLlm(fournisseur, "secure-groq", "groq/llama-3.1-8b-instant", "Groq", StatutModeleLlm.ACTIF);
        geminiModel = new ModeleLlm(gemini, "secure-gemini", "gemini/gemini-3.6-flash", "Gemini", StatutModeleLlm.ACTIF);
        conversation = new Conversation(demoUser, model, "Bonjour");
        service = new ConversationService(
                conversationRepository,
                messageRepository,
                modeleLlmRepository,
                currentUserService,
                liteLlmService,
                dlpService,
                messagePersistenceService,
                chatValidationService,
                10
        );
        lenient().when(demoUser.getExternalId()).thenReturn("demo-user");
        lenient().when(currentUserService.resolve(any(Jwt.class))).thenReturn(demoUser);
        lenient().when(currentUserService.keycloakId(any(Jwt.class))).thenReturn(testUserId);
        lenient().when(chatValidationService.getBannedWords(any())).thenReturn(List.of());
        lenient().when(chatValidationService.getBannedWords(any(), any())).thenReturn(List.of());
        lenient().when(dlpService.safeTextForLlm(any(), eq("demo-user"), any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(dlpService.safeUserMessage(any(), eq(testUserId), eq("demo-user"), any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createConversationUsesActiveModelAndDemoUser() {
        when(modeleLlmRepository.findByAliasInterneAndStatut("secure-groq", StatutModeleLlm.ACTIF))
                .thenReturn(Optional.of(model));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(new CreateConversationRequest("secure-groq", "Test"), jwt);

        assertThat(response.modelAlias()).isEqualTo("secure-groq");
        assertThat(response.title()).isEqualTo("Test");
        verify(conversationRepository).save(any(Conversation.class));
    }

    @Test
    void createConversationRejectsUnknownOrInactiveModel() {
        when(modeleLlmRepository.findByAliasInterneAndStatut("unknown", StatutModeleLlm.ACTIF))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(new CreateConversationRequest("unknown", "Test"), jwt))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Unknown or inactive model");
    }

    @Test
    void prepareStreamPersistsUserMessageAndBuildsContextInOrder() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(messageRepository.findMaxOrdre(conversation)).thenReturn(2);
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Message previousUser = new Message(conversation, RoleMessage.USER, 1, StatutMessage.TERMINE, "Bonjour", null);
        Message previousAssistant = new Message(conversation, RoleMessage.ASSISTANT, 2, StatutMessage.TERMINE, "Salut", previousUser);
        when(messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(eq(conversation), eq(StatutMessage.TERMINE), any()))
                .thenReturn(List.of(previousUser, previousAssistant));

        var preparation = service.prepareStream(10L, new SendMessageRequest("Suite"), jwt);

        assertThat(preparation.modelAlias()).isEqualTo("secure-groq");
        assertThat(preparation.assistantMessage().modelAlias()).isEqualTo("secure-groq");
        assertThat(preparation.assistantMessage().modelDisplayName()).isEqualTo("Groq");
        assertThat(preparation.context())
                .extracting(LiteLlmMessage::content)
                .containsExactly("Bonjour", "Salut");
    }

    @Test
    void changeModelUpdatesCurrentConversationModelWhenTargetIsActive() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(modeleLlmRepository.findByAliasInterneAndStatut("secure-gemini", StatutModeleLlm.ACTIF))
                .thenReturn(Optional.of(geminiModel));

        var response = service.changeModel(10L, new ChangeConversationModelRequest("secure-gemini"), jwt);

        assertThat(response.modelAlias()).isEqualTo("secure-gemini");
        assertThat(response.modelDisplayName()).isEqualTo("Gemini");
    }

    @Test
    void changeModelRejectsUnknownOrInactiveModel() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(modeleLlmRepository.findByAliasInterneAndStatut("inactive", StatutModeleLlm.ACTIF))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeModel(10L, new ChangeConversationModelRequest("inactive"), jwt))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Unknown or inactive model");
    }

    @Test
    void deletePermanentRemovesMessagesBeforeConversation() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(conversationRepository.deleteOwnedById(10L, demoUser)).thenReturn(1);

        service.deletePermanent(10L, jwt);

        InOrder order = inOrder(messageRepository, conversationRepository);
        order.verify(messageRepository).clearResponseLinksByConversationId(10L);
        order.verify(messageRepository).deleteAllByConversationId(10L);
        order.verify(messageRepository).flush();
        order.verify(conversationRepository).deleteOwnedById(10L, demoUser);
    }

    @Test
    void deletePermanentRejectsUnknownConversationWithoutDeletingMessages() {
        when(conversationRepository.findOwnedById(99L, demoUser)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deletePermanent(99L, jwt))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Conversation not found");

        verify(messageRepository, never()).deleteAllByConversationId(99L);
        verify(conversationRepository, never()).deleteOwnedById(99L, demoUser);
    }

    @Test
    void archiveOnlyChangesConversationStatus() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));

        service.archive(10L, jwt);

        assertThat(conversation.getStatut()).isEqualTo(com.example.backend.enums.StatutConversation.ARCHIVEE);
        verify(messageRepository, never()).deleteAllByConversationId(10L);
        verify(conversationRepository, never()).deleteOwnedById(10L, demoUser);
    }

    @Test
    void restoreChangesArchivedConversationBackToActive() {
        conversation.archive();
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));

        var response = service.restore(10L, jwt);

        assertThat(conversation.getStatut()).isEqualTo(com.example.backend.enums.StatutConversation.ACTIVE);
        assertThat(response.status()).isEqualTo("ACTIVE");
        verify(messageRepository, never()).deleteAllByConversationId(10L);
        verify(conversationRepository, never()).deleteOwnedById(10L, demoUser);
    }

    @Test
    void prepareStreamUsesNewCurrentModelAndKeepsExistingContext() {
        conversation.changeModel(geminiModel);
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(messageRepository.findMaxOrdre(conversation)).thenReturn(2);
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Message previousUser = new Message(conversation, RoleMessage.USER, 1, StatutMessage.TERMINE, "Question Groq", null);
        Message previousAssistant = new Message(conversation, RoleMessage.ASSISTANT, 2, StatutMessage.TERMINE, "Reponse Groq", previousUser, model);
        when(messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(eq(conversation), eq(StatutMessage.TERMINE), any()))
                .thenReturn(List.of(previousUser, previousAssistant));

        var preparation = service.prepareStream(10L, new SendMessageRequest("Question Gemini"), jwt);

        assertThat(preparation.modelAlias()).isEqualTo("secure-gemini");
        assertThat(preparation.assistantMessage().modelAlias()).isEqualTo("secure-gemini");
        assertThat(preparation.context())
                .extracting(LiteLlmMessage::content)
                .containsExactly("Question Groq", "Reponse Groq");
    }

    @Test
    void prepareStreamUsesMaskedCurrentPromptOnlyForLiteLlmContext() {
        AtomicReference<Message> savedUserMessage = new AtomicReference<>();
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(messageRepository.findMaxOrdre(conversation)).thenReturn(0);
        when(dlpService.safeUserMessage("Mon secret est 1234", testUserId, "demo-user", List.of())).thenReturn("Mon secret est [MASKED]");
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            if (message.getRole() == RoleMessage.USER) {
                savedUserMessage.set(message);
            }
            return message;
        });
        when(messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(eq(conversation), eq(StatutMessage.TERMINE), any()))
                .thenAnswer(invocation -> List.of(savedUserMessage.get()));

        var preparation = service.prepareStream(10L, new SendMessageRequest("Mon secret est 1234"), jwt);

        assertThat(preparation.userMessage().content()).isEqualTo("Mon secret est 1234");
        assertThat(preparation.context())
                .extracting(LiteLlmMessage::content)
                .containsExactly("Mon secret est [MASKED]");
    }

    @Test
    void streamMessageSendsAllowedTextToLiteLlm() {
        List<LiteLlmMessage> payload = streamAndCaptureLiteLlmPayload(
                List.of(),
                "Texte normal",
                "Texte normal"
        );

        assertThat(payload)
                .extracting(LiteLlmMessage::content)
                .contains("Texte normal");
    }

    @Test
    void streamMessageNeverSendsMaskedCurrentEmailToLiteLlm() {
        List<LiteLlmMessage> payload = streamAndCaptureLiteLlmPayload(
                List.of(),
                "Mon email est client@example.com",
                "Mon email est [EMAIL]"
        );

        assertThat(payload)
                .extracting(LiteLlmMessage::content)
                .doesNotContain("Mon email est client@example.com")
                .contains("Mon email est [EMAIL]");
        assertThat(joinPayload(payload)).doesNotContain("client@example.com");
    }

    @ParameterizedTest
    @MethodSource("historicalSensitiveMessages")
    void streamMessageNeverSendsSensitiveHistoryToLiteLlm(String original, String masked, String forbidden) {
        Message previousUser = new Message(conversation, RoleMessage.USER, 1, StatutMessage.TERMINE, original, null);
        List<LiteLlmMessage> payload = streamAndCaptureLiteLlmPayload(
                List.of(previousUser),
                "redonne-moi cette information",
                "redonne-moi cette information",
                original,
                masked
        );

        assertThat(joinPayload(payload)).doesNotContain(forbidden);
        assertThat(payload)
                .extracting(LiteLlmMessage::content)
                .contains(masked, "redonne-moi cette information");
    }

    @ParameterizedTest
    @CsvSource({
            "Le mot CIN peut designer une carte nationale sans numero.",
            "Cette API publique documente un modele de test.",
            "La carte du site montre les sections techniques.",
            "Le numero de ticket INC-2026-0001 est interne.",
            "Le nom du modele est secure-gemini."
    })
    void streamMessageKeepsStreamingForNormalTechnicalPhrasesWhenDlpAllows(String prompt) {
        List<LiteLlmMessage> payload = streamAndCaptureLiteLlmPayload(
                List.of(),
                prompt,
                prompt
        );

        assertThat(payload)
                .extracting(LiteLlmMessage::content)
                .contains(prompt);
    }

    @ParameterizedTest
    @CsvSource({
            "Ma CIN est AB123456,moroccan_cin",
            "Ma carte est 4111111111111111,credit_card",
            "Ma cle API est sk-proj-abcdefghijklmnopqrstuvwxyz1234567890,openai_api_key"
    })
    void streamMessageDoesNotCallLiteLlmWhenDlpBlocksSensitiveInput(String prompt, String type) {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(dlpService.safeUserMessage(prompt, testUserId, "demo-user", List.of()))
                .thenThrow(new DlpBlockedException("HIGH", Set.of(type)));

        service.streamMessage(10L, new SendMessageRequest(prompt), jwt);

        verify(liteLlmService, never()).streamChat(any(), any(), any(), any(), any());
        verify(messageRepository, never()).save(any(Message.class));
    }

    @ParameterizedTest
    @CsvSource({
            "timeout",
            "http-500",
            "invalid-json",
            "unknown-decision",
            "status-error"
    })
    void streamMessageDoesNotCallLiteLlmWhenDlpIsUnavailable(String failureMode) {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(dlpService.safeUserMessage("Bonjour", testUserId, "demo-user", List.of()))
                .thenThrow(new DlpUnavailableException("DLP failure: " + failureMode));

        service.streamMessage(10L, new SendMessageRequest("Bonjour"), jwt);

        verify(liteLlmService, never()).streamChat(any(), any(), any(), any(), any());
        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void streamMessageDlpFailureDoesNotEmitPartialTokens() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(dlpService.safeUserMessage("Ma CIN est AB123456", testUserId, "demo-user", List.of()))
                .thenThrow(new DlpBlockedException("HIGH", Set.of("moroccan_cin")));

        service.streamMessage(10L, new SendMessageRequest("Ma CIN est AB123456"), jwt);

        verify(liteLlmService, never()).streamChat(any(), any(), any(), any(), any());
        verify(messagePersistenceService, never()).completeAssistantMessage(any(), any());
        verify(messagePersistenceService, never()).failAssistantMessage(any(), any());
    }

    @Test
    void streamMessageDoesNotCallLiteLlmWhenDlpBlocks() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(dlpService.safeUserMessage("secret", testUserId, "demo-user", List.of()))
                .thenThrow(new DlpBlockedException("HIGH", Set.of("API_KEY")));

        service.streamMessage(10L, new SendMessageRequest("secret"), jwt);

        verify(liteLlmService, never()).streamChat(any(), any(), any(), any(), any());
        verify(messageRepository, never()).save(any(Message.class));
    }

    @Test
    void streamMessageCompletesAssistantMessageWhenLiteLlmFinishes() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(messageRepository.findMaxOrdre(conversation)).thenReturn(0);
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(eq(conversation), eq(StatutMessage.TERMINE), any()))
                .thenReturn(List.of(new Message(conversation, RoleMessage.USER, 1, StatutMessage.TERMINE, "Question", null)));
        doAnswer(invocation -> {
            Consumer<String> onToken = invocation.getArgument(2);
            Runnable onComplete = invocation.getArgument(3);
            onToken.accept("Reponse");
            onComplete.run();
            return null;
        }).when(liteLlmService).streamChat(eq("secure-groq"), any(), any(), any(), any());

        service.streamMessage(10L, new SendMessageRequest("Question"), jwt);

        verify(messagePersistenceService).completeAssistantMessage(any(), eq("Reponse"));
    }

    @Test
    void streamMessageMarksAssistantMessageFailedWhenLiteLlmFails() {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(messageRepository.findMaxOrdre(conversation)).thenReturn(0);
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(eq(conversation), eq(StatutMessage.TERMINE), any()))
                .thenReturn(List.of());
        doAnswer(invocation -> {
            Consumer<Throwable> onError = invocation.getArgument(4);
            onError.accept(new RuntimeException("boom"));
            return null;
        }).when(liteLlmService).streamChat(eq("secure-groq"), any(), any(), any(), any());

        service.streamMessage(10L, new SendMessageRequest("Question"), jwt);

        verify(messagePersistenceService).failAssistantMessage(any(), eq("Erreur pendant le streaming LiteLLM."));
    }

    @Test
    void conversationLookupIsScopedToDemoUser() {
        when(conversationRepository.findOwnedById(99L, demoUser)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.messages(99L, jwt))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Conversation not found");
    }

    @Test
    void conversationLookupResolvesOwnershipFromAuthenticatedJwt() {
        Jwt otherJwt = Jwt.withTokenValue("other-token")
                .header("alg", "none")
                .subject("other-user")
                .build();
        when(currentUserService.resolve(otherJwt)).thenReturn(otherUser);
        when(conversationRepository.findOwnedById(99L, otherUser)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.messages(99L, otherJwt))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Conversation not found");

        verify(conversationRepository).findOwnedById(99L, otherUser);
    }

    private List<LiteLlmMessage> streamAndCaptureLiteLlmPayload(
            List<Message> previousMessages,
            String prompt,
            String safePrompt
    ) {
        return streamAndCaptureLiteLlmPayload(previousMessages, prompt, safePrompt, null, null);
    }

    private List<LiteLlmMessage> streamAndCaptureLiteLlmPayload(
            List<Message> previousMessages,
            String prompt,
            String safePrompt,
            String historicalOriginal,
            String historicalMasked
    ) {
        when(conversationRepository.findOwnedById(10L, demoUser)).thenReturn(Optional.of(conversation));
        when(messageRepository.findMaxOrdre(conversation)).thenReturn(previousMessages.size());
        when(dlpService.safeUserMessage(prompt, testUserId, "demo-user", List.of())).thenReturn(safePrompt);
        if (historicalOriginal != null) {
            when(dlpService.safeTextForLlm(historicalOriginal, "demo-user", List.of())).thenReturn(historicalMasked);
        }
        AtomicReference<Message> savedUserMessage = new AtomicReference<>();
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            if (message.getRole() == RoleMessage.USER) {
                savedUserMessage.set(message);
            }
            return message;
        });
        when(messageRepository.findByConversationAndStatutAndRoleInOrderByOrdreAsc(eq(conversation), eq(StatutMessage.TERMINE), any()))
                .thenAnswer(invocation -> {
                    List<Message> messages = new java.util.ArrayList<>(previousMessages);
                    if (savedUserMessage.get() != null) {
                        messages.add(savedUserMessage.get());
                    }
                    return messages;
                });

        ArgumentCaptor<List<LiteLlmMessage>> payloadCaptor = ArgumentCaptor.captor();
        doAnswer(invocation -> {
            Runnable onComplete = invocation.getArgument(3);
            onComplete.run();
            return null;
        }).when(liteLlmService).streamChat(eq("secure-groq"), payloadCaptor.capture(), any(), any(), any());

        service.streamMessage(10L, new SendMessageRequest(prompt), jwt);

        verify(liteLlmService, times(1)).streamChat(eq("secure-groq"), any(), any(), any(), any());
        return payloadCaptor.getValue();
    }

    private String joinPayload(List<LiteLlmMessage> payload) {
        return payload.stream()
                .map(LiteLlmMessage::content)
                .reduce("", (left, right) -> left + "\n" + right);
    }

    private static Stream<Arguments> historicalSensitiveMessages() {
        return Stream.of(
                Arguments.of("Mon email est client@example.com", "Mon email est [EMAIL]", "client@example.com"),
                Arguments.of("Mon telephone est 0612345678", "Mon telephone est [PHONE]", "0612345678"),
                Arguments.of("Mon RIB est 007780000004567890123456", "Mon RIB est [RIB]", "007780000004567890123456"),
                Arguments.of("Mon IBAN est MA64011519000001205000534921", "Mon IBAN est [IBAN]", "MA64011519000001205000534921"),
                Arguments.of("La personne est Jean Dupont", "La personne est [PERSON]", "Jean Dupont"),
                Arguments.of("Adresse IP 192.168.1.24", "Adresse IP [IP_ADDRESS]", "192.168.1.24"),
                Arguments.of("Token ghp_abcdefghijklmnopqrstuvwxyz123456", "Token [TOKEN]", "ghp_abcdefghijklmnopqrstuvwxyz123456")
        );
    }
}
