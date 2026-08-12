package com.example.backend.controller;

import com.example.backend.dto.ModelDto;
import com.example.backend.service.ChatService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.example.backend.service.CurrentUserService;

@RestController
@RequestMapping("/api")
public class ModelController {

    private final ChatService chatService;
    private final CurrentUserService currentUserService;

    public ModelController(ChatService chatService, CurrentUserService currentUserService) {
        this.chatService = chatService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/models")
    public List<String> models(@AuthenticationPrincipal Jwt jwt) {
        return chatService.getAvailableModels(currentUserService.keycloakId(jwt), currentUserService.roles(jwt));
    }

    @GetMapping("/models/details")
    public List<ModelDto> modelDetails(@AuthenticationPrincipal Jwt jwt) {
        return chatService.getAvailableModelDetails(currentUserService.keycloakId(jwt), currentUserService.roles(jwt));
    }
}
