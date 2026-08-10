package com.example.backend.controller;

import com.example.backend.dto.ConversationPageResponse;
import com.example.backend.dto.ConversationResponse;
import com.example.backend.dto.MessageResponse;
import com.example.backend.dto.SendMessageRequest;
import com.example.backend.service.ConversationService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

@ExtendWith(MockitoExtension.class)
class ConversationControllerTest {

    private static final UUID USER_ID = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");

    @Mock
    private ConversationService conversationService;

    private ConversationController controller;
    private MockMvc mockMvc;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ConversationController(conversationService);
        mockMvc = standaloneSetup(controller)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(USER_ID.toString())
                .build();
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(jwt, null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void conversationListPassesAuthenticatedJwtAndQueryFiltersToService() throws Exception {
        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        ConversationResponse conversation = new ConversationResponse(
                42L, "Project", "secure-groq", "Groq", "ACTIVE", created, created, created);
        ConversationPageResponse page = new ConversationPageResponse(List.of(conversation), 0, 20, 1, 1);
        when(conversationService.list("secure-groq", "project", false, 0, 20, jwt)).thenReturn(page);

        mockMvc.perform(get("/api/conversations")
                        .param("modelAlias", "secure-groq")
                        .param("search", "project")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(content().json("{\"content\":[{\"id\":42,\"title\":\"Project\",\"modelAlias\":\"secure-groq\",\"status\":\"ACTIVE\"}],\"totalElements\":1,\"totalPages\":1}"));

        verify(conversationService).list("secure-groq", "project", false, 0, 20, jwt);
    }

    @Test
    void messageHistoryPassesAuthenticatedJwtAndConversationIdToService() throws Exception {
        MessageResponse message = new MessageResponse(
                7L, "USER", 1, "TERMINE", "Hello", null, null, null, null, null);
        when(conversationService.messages(42L, jwt)).thenReturn(List.of(message));

        mockMvc.perform(get("/api/conversations/42/messages"))
                .andExpect(status().isOk())
                .andExpect(content().json("[{\"id\":7,\"role\":\"USER\",\"content\":\"Hello\"}]"));

        verify(conversationService).messages(42L, jwt);
    }

    @Test
    void streamingEndpointDelegatesAuthenticatedJwtAndMessageRequest() {
        SseEmitter emitter = new SseEmitter();
        SendMessageRequest request = new SendMessageRequest("Hello");
        when(conversationService.streamMessage(42L, request, jwt)).thenReturn(emitter);

        assertThat(controller.streamConversationMessage(42L, request, jwt)).isSameAs(emitter);

        verify(conversationService).streamMessage(42L, request, jwt);
    }
}
