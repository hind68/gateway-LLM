package com.example.backend.service;

import com.example.backend.dto.ChatRequest;
import com.example.backend.dto.ModelDto;
import com.example.backend.entity.FournisseurLlm;
import com.example.backend.entity.ModeleLlm;
import com.example.backend.enums.StatutFournisseurLlm;
import com.example.backend.enums.StatutModeleLlm;
import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.exceptions.DlpUnavailableException;
import com.example.backend.integration.litellm.LiteLlmService;
import com.example.backend.repository.ModeleLlmRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    private LiteLlmService liteLlmService;

    @Mock
    private ModeleLlmRepository modeleLlmRepository;

    @Mock
    private DlpService dlpService;

    @Mock
    private ChatValidationService chatValidationService;

    @InjectMocks
    private ChatService chatService;

    private final UUID testUserId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");

    @BeforeEach
    void setUp() {
        lenient().when(chatValidationService.getBannedWords(any(), any())).thenReturn(List.of());
    }

    @Test
    void getAvailableModelsReturnsActiveInternalAliases() {
        FournisseurLlm fournisseur = new FournisseurLlm("groq", "Groq", StatutFournisseurLlm.ACTIF);
        ModeleLlm model = new ModeleLlm(fournisseur, "secure-groq", "groq/llama-3.1-8b-instant", "Groq", StatutModeleLlm.ACTIF);
        when(modeleLlmRepository.findByStatutOrderByIdAsc(StatutModeleLlm.ACTIF)).thenReturn(List.of(model));

        List<String> models = chatService.getAvailableModels();

        assertThat(models).containsExactly("secure-groq");
    }

    @Test
    void getAvailableModelDetailsReturnsActiveModels() {
        FournisseurLlm fournisseur = new FournisseurLlm("groq", "Groq", StatutFournisseurLlm.ACTIF);
        ModeleLlm model = new ModeleLlm(fournisseur, "secure-groq", "groq/llama-3.1-8b-instant", "Groq", StatutModeleLlm.ACTIF);
        when(modeleLlmRepository.findByStatutOrderByIdAsc(StatutModeleLlm.ACTIF)).thenReturn(List.of(model));

        List<ModelDto> models = chatService.getAvailableModelDetails();

        assertThat(models).containsExactly(new ModelDto("secure-groq", "Groq"));
    }

    @Test
    void chatSendsAllowedTextToLiteLlm() {
        ChatRequest request = new ChatRequest("secure-groq", "Hello");
        when(modeleLlmRepository.existsByAliasInterneAndStatut("secure-groq", StatutModeleLlm.ACTIF)).thenReturn(true);
        when(chatValidationService.getBannedWords(testUserId, List.of())).thenReturn(List.of());
        when(dlpService.safeUserMessage("Hello", testUserId, testUserId.toString(), List.of())).thenReturn("Hello");
        when(liteLlmService.chat("secure-groq", "Hello")).thenReturn("Hi there");

        var response = chatService.chat(request, testUserId);

        assertThat(response.model()).isEqualTo("secure-groq");
        assertThat(response.answer()).isEqualTo("Hi there");
    }

    @Test
    void chatRejectsUnsupportedModel() {
        ChatRequest request = new ChatRequest("unsupported", "Hello");
        when(modeleLlmRepository.existsByAliasInterneAndStatut("unsupported", StatutModeleLlm.ACTIF)).thenReturn(false);

        assertThatThrownBy(() -> chatService.chat(request, testUserId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Unsupported model");
    }

    @ParameterizedTest
    @CsvSource({
            "Ma CIN est AB123456, moroccan_cin",
            "Ma carte est 4111111111111111, credit_card"
    })
    void chatDoesNotCallLiteLlmWhenDlpBlocksSensitiveInput(String prompt, String type) {
        ChatRequest request = new ChatRequest("secure-groq", prompt);
        when(modeleLlmRepository.existsByAliasInterneAndStatut("secure-groq", StatutModeleLlm.ACTIF)).thenReturn(true);
        when(chatValidationService.getBannedWords(testUserId, List.of())).thenReturn(List.of());
        when(dlpService.safeUserMessage(prompt, testUserId, testUserId.toString(), List.of()))
                .thenThrow(new DlpBlockedException("HIGH", Set.of(type)));

        assertThatThrownBy(() -> chatService.chat(request, testUserId))
                .isInstanceOf(DlpBlockedException.class);

        verify(liteLlmService, never()).chat(any(String.class), any(String.class));
    }

    @Test
    void chatDoesNotCallLiteLlmWhenDlpIsUnavailable() {
        ChatRequest request = new ChatRequest("secure-groq", "Hello");
        when(modeleLlmRepository.existsByAliasInterneAndStatut("secure-groq", StatutModeleLlm.ACTIF)).thenReturn(true);
        when(chatValidationService.getBannedWords(testUserId, List.of())).thenReturn(List.of());
        when(dlpService.safeUserMessage("Hello", testUserId, testUserId.toString(), List.of()))
                .thenThrow(new DlpUnavailableException("DLP unavailable"));

        assertThatThrownBy(() -> chatService.chat(request, testUserId))
                .isInstanceOf(DlpUnavailableException.class);

        verify(liteLlmService, never()).chat(any(String.class), any(String.class));
    }

    @Test
    void chatRejectsModelRestrictedForUserBeforeDlpOrLiteLlm() {
        ChatRequest request = new ChatRequest("secure-groq", "Hello");
        when(modeleLlmRepository.existsByAliasInterneAndStatut("secure-groq", StatutModeleLlm.ACTIF)).thenReturn(true);
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Model restricted for user"))
                .when(chatValidationService).validateLlmAccess(testUserId, "secure-groq", List.of());

        assertThatThrownBy(() -> chatService.chat(request, testUserId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Model restricted for user");

        verify(dlpService, never()).safeUserMessage(any(), any(), any(), any());
        verify(liteLlmService, never()).chat(any(String.class), any(String.class));
    }
}
