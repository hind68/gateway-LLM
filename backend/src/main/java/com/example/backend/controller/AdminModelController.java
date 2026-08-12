package com.example.backend.controller;

import com.example.backend.entity.AuditLog;
import com.example.backend.entity.FournisseurLlm;
import com.example.backend.entity.ModeleLlm;
import com.example.backend.enums.StatutFournisseurLlm;
import com.example.backend.enums.StatutModeleLlm;
import com.example.backend.integration.litellm.LiteLlmService;
import com.example.backend.repository.AuditLogRepository;
import com.example.backend.repository.FournisseurLlmRepository;
import com.example.backend.repository.ModeleLlmRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/models")
@PreAuthorize("hasRole('ADMIN')")
public class AdminModelController {

    private final FournisseurLlmRepository providers;
    private final ModeleLlmRepository models;
    private final AuditLogRepository audits;
    private final LiteLlmService liteLlm;

    public AdminModelController(
            FournisseurLlmRepository providers,
            ModeleLlmRepository models,
            AuditLogRepository audits,
            LiteLlmService liteLlm
    ) {
        this.providers = providers;
        this.models = models;
        this.audits = audits;
        this.liteLlm = liteLlm;
    }

    @GetMapping("/providers")
    @Transactional(readOnly = true)
    public List<AdminProviderResponse> providers() {
        return providers.findAll()
                .stream()
                .map(this::toProviderResponse)
                .toList();
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<AdminModelResponse> models() {
        return models.findAll()
                .stream()
                .map(this::toModelResponse)
                .toList();
    }

    @PostMapping("/providers")
    @Transactional
    public AdminProviderResponse createProvider(
            @RequestBody Map<String, String> body,
            JwtAuthenticationToken auth
    ) {
        FournisseurLlm provider = new FournisseurLlm(
                required(body, "code"),
                required(body, "name"),
                status(body.get("status"), StatutFournisseurLlm.ACTIF)
        );

        FournisseurLlm saved = providers.save(provider);

        audit("CREATE", "LLM_PROVIDER", saved.getCode(), auth);

        return toProviderResponse(saved);
    }

    @PatchMapping("/providers/{id}/status")
    @Transactional
    public void setProviderStatus(
            @PathVariable Long id,
            @RequestParam StatutFournisseurLlm status,
            JwtAuthenticationToken auth
    ) {
        FournisseurLlm provider = providers.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Provider not found"
                        )
                );

        provider.setStatut(status);
        providers.save(provider);

        audit("STATUS", "LLM_PROVIDER", provider.getCode(), auth);
    }

    @PostMapping
    @Transactional
    public AdminModelResponse createModel(
            @RequestBody Map<String, String> body,
            JwtAuthenticationToken auth
    ) {
        Long providerId = Long.valueOf(required(body, "providerId"));

        FournisseurLlm provider = providers.findById(providerId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Provider not found"
                        )
                );

        ModeleLlm model = new ModeleLlm(
                provider,
                required(body, "alias"),
                required(body, "providerModel"),
                required(body, "displayName"),
                status(body.get("status"), StatutModeleLlm.ACTIF)
        );

        ModeleLlm saved = models.save(model);

        audit("CREATE", "LLM_MODEL", saved.getAliasInterne(), auth);

        return toModelResponse(saved);
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public void setModelStatus(
            @PathVariable Long id,
            @RequestParam StatutModeleLlm status,
            JwtAuthenticationToken auth
    ) {
        ModeleLlm model = models.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Model not found"
                        )
                );

        model.setStatut(status);
        models.save(model);

        audit("STATUS", "LLM_MODEL", model.getAliasInterne(), auth);
    }

    @PostMapping("/{id}/test")
    @Transactional(readOnly = true)
    public Map<String, Object> testModel(@PathVariable Long id) {
        ModeleLlm model = models.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Model not found"
                        )
                );

        long started = System.currentTimeMillis();

        try {
            liteLlm.chat(model.getAliasInterne(), "Respond with OK.");

            return Map.of(
                    "status", "CONNECTED",
                    "latencyMs", System.currentTimeMillis() - started,
                    "model", model.getAliasInterne()
            );
        } catch (RuntimeException exception) {
            return Map.of(
                    "status", "FAILED",
                    "latencyMs", System.currentTimeMillis() - started,
                    "model", model.getAliasInterne(),
                    "message", String.valueOf(exception.getMessage())
            );
        }
    }

    private AdminProviderResponse toProviderResponse(FournisseurLlm provider) {
        return new AdminProviderResponse(
                provider.getId(),
                provider.getCode(),
                provider.getNom(),
                provider.getStatut().name()
        );
    }

    private AdminModelResponse toModelResponse(ModeleLlm model) {
        FournisseurLlm provider = model.getFournisseur();

        return new AdminModelResponse(
                model.getId(),
                model.getAliasInterne(),
                model.getNomAffichage(),
                model.getNomModeleProvider(),
                model.getStatut().name(),
                provider.getId(),
                provider.getCode(),
                provider.getNom(),
                provider.getStatut().name()
        );
    }

    private String required(Map<String, String> body, String name) {
        String value = body.get(name);

        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Missing field: " + name
            );
        }

        return value.trim();
    }

    private <T extends Enum<T>> T status(String value, T fallback) {
        return value == null || value.isBlank()
                ? fallback
                : Enum.valueOf(
                fallback.getDeclaringClass(),
                value.toUpperCase()
        );
    }

    private void audit(
            String action,
            String entity,
            String id,
            JwtAuthenticationToken auth
    ) {
        audits.save(
                new AuditLog(
                        action,
                        entity,
                        id,
                        UUID.fromString(auth.getToken().getSubject())
                )
        );
    }

    public record AdminProviderResponse(
            Long id,
            String code,
            String nom,
            String statut
    ) {
    }

    public record AdminModelResponse(
            Long id,
            String aliasInterne,
            String nomAffichage,
            String nomModeleProvider,
            String statut,
            Long providerId,
            String providerCode,
            String providerName,
            String providerStatus
    ) {
    }
}