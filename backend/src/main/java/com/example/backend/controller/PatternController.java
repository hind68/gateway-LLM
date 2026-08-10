package com.example.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.backend.entity.Pattern;
import com.example.backend.entity.PatternWrapper;
import com.example.backend.entity.AuditLog;
import com.example.backend.repository.AuditLogRepository;
import com.example.backend.integration.dlp.DlpPatternClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/permissions/patterns")
public class PatternController {

    @Value("${dlp.patterns.file}")
    private String filePath;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AuditLogRepository auditLogRepository;
    private final DlpPatternClient dlpPatternClient;

    public PatternController(AuditLogRepository auditLogRepository, DlpPatternClient dlpPatternClient) {
        this.auditLogRepository = auditLogRepository;
        this.dlpPatternClient = dlpPatternClient;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Pattern> getPatterns() throws IOException {
        File file = new File(filePath);
        if (!file.exists()) {
            return new ArrayList<>();
        }
        PatternWrapper wrapper = objectMapper.readValue(file, PatternWrapper.class);
        return wrapper.getPatterns() != null ? wrapper.getPatterns() : new ArrayList<>();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Pattern addPattern(@RequestBody Pattern newPattern, JwtAuthenticationToken auth) throws IOException {
        File file = new File(filePath);
        PatternWrapper wrapper = new PatternWrapper();
        wrapper.setPatterns(new ArrayList<>());

        if (file.getParentFile() != null && !file.getParentFile().exists()) {
            file.getParentFile().mkdirs();
        }

        if (file.exists()) {
            wrapper = objectMapper.readValue(file, PatternWrapper.class);
            if (wrapper.getPatterns() == null) {
                wrapper.setPatterns(new ArrayList<>());
            }
        }

        if (newPattern.getName() == null || newPattern.getName().isEmpty()) {
            newPattern.setName("custom_" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (newPattern.getType() == null) {
            newPattern.setType("custom");
        }
        if (newPattern.getSeverity() == null) {
            newPattern.setSeverity("high");
        }

        wrapper.getPatterns().add(newPattern);

        objectMapper.writeValue(file, wrapper);
        dlpPatternClient.synchronize(wrapper.getPatterns());
        auditLogRepository.save(new AuditLog("CREATE", "DLP_PATTERN", newPattern.getName(), performer(auth)));

        return newPattern;
    }

    @PutMapping("/{name}")
    @PreAuthorize("hasRole('ADMIN')")
    public Pattern updatePattern(@PathVariable String name, @RequestBody Pattern updatedPattern, JwtAuthenticationToken auth) throws IOException {
        File file = new File(filePath);
        if (!file.exists()) {
            throw new IllegalArgumentException("Pattern file does not exist");
        }
        PatternWrapper wrapper = objectMapper.readValue(file, PatternWrapper.class);
        Pattern existing = wrapper.getPatterns() == null ? null : wrapper.getPatterns().stream()
                .filter(pattern -> name.equals(pattern.getName()))
                .findFirst()
                .orElse(null);
        if (existing == null) {
            throw new IllegalArgumentException("Pattern not found: " + name);
        }
        updatedPattern.setName(name);
        if (updatedPattern.getType() == null || updatedPattern.getType().isBlank()) updatedPattern.setType(existing.getType());
        if (updatedPattern.getPattern() == null || updatedPattern.getPattern().isBlank()) updatedPattern.setPattern(existing.getPattern());
        if (updatedPattern.getSeverity() == null || updatedPattern.getSeverity().isBlank()) updatedPattern.setSeverity(existing.getSeverity());
        if (updatedPattern.getAction() == null || updatedPattern.getAction().isBlank()) updatedPattern.setAction(existing.getAction());
        if (updatedPattern.getEnabled() == null) updatedPattern.setEnabled(existing.getEnabled());
        wrapper.getPatterns().remove(existing);
        wrapper.getPatterns().add(updatedPattern);
        objectMapper.writeValue(file, wrapper);
        dlpPatternClient.synchronize(wrapper.getPatterns());
        auditLogRepository.save(new AuditLog("UPDATE", "DLP_PATTERN", name, performer(auth)));
        return updatedPattern;
    }

    @DeleteMapping("/{name}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deletePattern(@PathVariable String name, JwtAuthenticationToken auth) throws IOException {
        File file = new File(filePath);
        if (!file.exists()) {
            return;
        }

        PatternWrapper wrapper = objectMapper.readValue(file, PatternWrapper.class);
        if (wrapper.getPatterns() != null) {
            wrapper.getPatterns().removeIf(pattern -> name.equals(pattern.getName()));
            objectMapper.writeValue(file, wrapper);
            dlpPatternClient.synchronize(wrapper.getPatterns());
            auditLogRepository.save(new AuditLog("DELETE", "DLP_PATTERN", name, performer(auth)));
        }
    }

    private UUID performer(JwtAuthenticationToken auth) {
        return UUID.fromString(auth.getToken().getSubject());
    }
}
