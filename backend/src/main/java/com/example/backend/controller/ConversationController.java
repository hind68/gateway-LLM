package com.example.backend.controller;

import com.example.backend.dto.ChangeConversationModelRequest;
import com.example.backend.dto.ConversationPageResponse;
import com.example.backend.dto.ConversationResponse;
import com.example.backend.dto.CreateConversationRequest;
import com.example.backend.dto.MessageResponse;
import com.example.backend.dto.SendMessageRequest;
import com.example.backend.dto.UpdateConversationRequest;
import com.example.backend.service.ConversationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/conversations")
    public ConversationResponse createConversation(@Valid @RequestBody CreateConversationRequest request, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.create(request, jwt);
    }

    @GetMapping("/conversations")
    public ConversationPageResponse conversations(
            @RequestParam(required = false) String modelAlias,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "false") boolean archived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return conversationService.list(modelAlias, search, archived, page, size, jwt);
    }

    @GetMapping("/conversations/{id}")
    public ConversationResponse conversation(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.get(id, jwt);
    }

    @PatchMapping("/conversations/{id}")
    public ConversationResponse updateConversation(@PathVariable Long id, @Valid @RequestBody UpdateConversationRequest request, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.update(id, request, jwt);
    }

    @PatchMapping("/conversations/{id}/model")
    public ConversationResponse changeConversationModel(@PathVariable Long id, @Valid @RequestBody ChangeConversationModelRequest request, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.changeModel(id, request, jwt);
    }

    @DeleteMapping("/conversations/{id}")
    public void archiveConversation(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        conversationService.archive(id, jwt);
    }

    @PatchMapping("/conversations/{id}/restore")
    public ConversationResponse restoreConversation(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.restore(id, jwt);
    }

    @DeleteMapping("/conversations/{id}/permanent")
    public void deleteConversation(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        conversationService.deletePermanent(id, jwt);
    }

    @GetMapping("/conversations/{id}/messages")
    public List<MessageResponse> conversationMessages(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.messages(id, jwt);
    }

    @PostMapping(value = "/conversations/{id}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamConversationMessage(@PathVariable Long id, @Valid @RequestBody SendMessageRequest request, @AuthenticationPrincipal Jwt jwt) {
        return conversationService.streamMessage(id, request, jwt);
    }

    @PostMapping(value = "/conversations/{id}/messages/stream-with-files", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamConversationMessageWithFiles(
            @PathVariable Long id,
            @RequestPart(required = false, name = "content") String content,
            @RequestPart(required = false, name = "files") List<MultipartFile> files,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return conversationService.streamMessageWithFiles(id, content, files == null ? List.of() : files, jwt);
    }
}
