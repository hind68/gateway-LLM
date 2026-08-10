package com.example.backend.controller;

import com.example.backend.dto.ChatResponse;
import com.example.backend.service.ChatService;
import com.example.backend.service.CurrentUserService;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

    private static final UUID USER_ID = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");

    @Mock
    private ChatService chatService;

    @Mock
    private CurrentUserService currentUserService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        ChatController controller = new ChatController(chatService, currentUserService);
        mockMvc = standaloneSetup(controller)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatedChatRequestResolvesJwtAndDelegatesToService() throws Exception {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(USER_ID.toString())
                .build();
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(jwt, null));
        when(currentUserService.keycloakId(jwt)).thenReturn(USER_ID);
        when(currentUserService.roles(jwt)).thenReturn(java.util.List.of());
        when(chatService.chat(eq(new com.example.backend.dto.ChatRequest("secure-groq", "Hello")), eq(USER_ID), any()))
                .thenReturn(new ChatResponse("secure-groq", "Bonjour"));

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"model\":\"secure-groq\",\"message\":\"Hello\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"model\":\"secure-groq\",\"answer\":\"Bonjour\"}"));

        verify(currentUserService).keycloakId(jwt);
        verify(currentUserService).roles(jwt);
        verify(chatService).chat(new com.example.backend.dto.ChatRequest("secure-groq", "Hello"), USER_ID, java.util.List.of());
    }
}
