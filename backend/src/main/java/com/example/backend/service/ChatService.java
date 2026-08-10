package com.example.backend.service;

import com.example.backend.dto.ChatRequest;
import com.example.backend.dto.ChatResponse;
import com.example.backend.dto.ModelDto;
import com.example.backend.entity.ModeleLlm;
import com.example.backend.enums.StatutModeleLlm;
import com.example.backend.integration.litellm.LiteLlmService;
import com.example.backend.repository.ModeleLlmRepository;
import java.util.List;
import java.util.Collection;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class ChatService {

    private final LiteLlmService liteLlmService;
    private final ModeleLlmRepository modeleLlmRepository;
    private final DlpService dlpService;
    private final ChatValidationService chatValidationService;

    public ChatService(
            LiteLlmService liteLlmService,
            ModeleLlmRepository modeleLlmRepository,
            DlpService dlpService,
            ChatValidationService chatValidationService
    ) {
        this.liteLlmService = liteLlmService;
        this.modeleLlmRepository = modeleLlmRepository;
        this.dlpService = dlpService;
        this.chatValidationService = chatValidationService;
    }

    public List<String> getAvailableModels() {
        return modeleLlmRepository.findByStatutOrderByIdAsc(StatutModeleLlm.ACTIF)
                .stream()
                .map(ModeleLlm::getAliasInterne)
                .toList();
    }

    public List<ModelDto> getAvailableModelDetails() {
        return modeleLlmRepository.findByStatutOrderByIdAsc(StatutModeleLlm.ACTIF)
                .stream()
                .map(model -> new ModelDto(model.getAliasInterne(), model.getNomAffichage()))
                .toList();
    }

    public ChatResponse chat(ChatRequest request, UUID userId) {
        return chat(request, userId, List.of());
    }

    public ChatResponse chat(ChatRequest request, UUID userId, Collection<String> roles) {
        if (!modeleLlmRepository.existsByAliasInterneAndStatut(request.model(), StatutModeleLlm.ACTIF)) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported model: " + request.model());
        }

        chatValidationService.validateLlmAccess(userId, request.model(), roles);
        List<String> bannedWords = chatValidationService.getBannedWords(userId, roles);
        String safeMessage = dlpService.safeUserMessage(
                request.message(),
                userId,
                userId.toString(),
                bannedWords
        );
        String answer = liteLlmService.chat(request.model(), safeMessage);

        return new ChatResponse(request.model(), answer);
    }
}
