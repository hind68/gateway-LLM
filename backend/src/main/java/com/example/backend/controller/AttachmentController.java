package com.example.backend.controller;

import com.example.backend.dto.AttachmentContentResponse;
import com.example.backend.dto.AttachmentInspectionResponse;
import com.example.backend.dto.AttachmentSecureResponse;
import com.example.backend.service.AttachmentService;
import com.example.backend.service.ConversationService;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api")
public class AttachmentController {

    private final AttachmentService attachmentService;
    private final ConversationService conversationService;

    public AttachmentController(AttachmentService attachmentService, ConversationService conversationService) {
        this.attachmentService = attachmentService;
        this.conversationService = conversationService;
    }

    @GetMapping("/attachments/{id}")
    public AttachmentContentResponse attachment(@PathVariable Long id) {
        return attachmentService.metadata(id);
    }

    @GetMapping("/attachments/{id}/content")
    public ResponseEntity<Resource> content(@PathVariable Long id) {
        return attachmentService.originalContent(id);
    }

    @GetMapping("/attachments/{id}/inspection")
    public AttachmentInspectionResponse inspection(@PathVariable Long id) {
        return attachmentService.inspection(id);
    }

    @GetMapping("/attachments/{id}/secure")
    public AttachmentSecureResponse secure(@PathVariable Long id) {
        return attachmentService.secure(id);
    }

    @GetMapping("/attachments/{id}/secure/download")
    public ResponseEntity<byte[]> secureDownload(@PathVariable Long id) {
        return attachmentService.secureDownload(id);
    }

    @PostMapping(value = "/conversations/{conversationId}/attachments/{id}/send-secure", produces = "text/event-stream;charset=UTF-8")
    public SseEmitter sendSecure(@PathVariable Long conversationId, @PathVariable Long id) {
        return conversationService.streamSecureAttachment(conversationId, id);
    }
}
