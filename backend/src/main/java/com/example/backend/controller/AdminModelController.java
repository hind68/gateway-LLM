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
import com.example.backend.repository.ConversationRepository;
import com.example.backend.repository.UserLlmRestrictionRepository;
import com.example.backend.repository.RoleLlmRestrictionRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.core.env.Environment;
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
    private final ConversationRepository conversations;
    private final UserLlmRestrictionRepository userRestrictions;
    private final RoleLlmRestrictionRepository roleRestrictions;
    private final Environment environment;

    public AdminModelController(
            FournisseurLlmRepository providers,
            ModeleLlmRepository models,
            AuditLogRepository audits,
            LiteLlmService liteLlm,
            ConversationRepository conversations,
            UserLlmRestrictionRepository userRestrictions,
            RoleLlmRestrictionRepository roleRestrictions,
            Environment environment
    ) {
        this.providers = providers;
        this.models = models;
        this.audits = audits;
        this.liteLlm = liteLlm;
        this.conversations = conversations;
        this.userRestrictions = userRestrictions;
        this.roleRestrictions = roleRestrictions;
        this.environment = environment;
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
        provider.setApiKeyEnvVar(apiKeyEnvVar(body.get("apiKeyEnvVar")));

        FournisseurLlm saved = providers.save(provider);

        audit("CREATE", "LLM_PROVIDER", saved.getCode(), auth);

        return toProviderResponse(saved);
    }

    @PatchMapping("/providers/{id}")
    @Transactional
    public AdminProviderResponse updateProvider(@PathVariable Long id, @RequestBody Map<String, String> body, JwtAuthenticationToken auth) {
        FournisseurLlm provider = providers.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Provider not found"));
        if (body.containsKey("code")) provider.setCode(required(body, "code"));
        if (body.containsKey("name")) provider.setNom(required(body, "name"));
        if (body.containsKey("status")) provider.setStatut(status(body.get("status"), provider.getStatut()));
        if (body.containsKey("apiKeyEnvVar")) provider.setApiKeyEnvVar(apiKeyEnvVar(body.get("apiKeyEnvVar")));
        providers.save(provider);
        audit("UPDATE", "LLM_PROVIDER", provider.getCode(), auth);
        return toProviderResponse(provider);
    }

    @DeleteMapping("/providers/{id}")
    @Transactional
    public void deleteProvider(@PathVariable Long id, JwtAuthenticationToken auth) {
        FournisseurLlm provider = providers.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Provider not found"));
        if (!provider.getModeles().isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Provider has configured models and cannot be deleted");
        providers.delete(provider);
        audit("DELETE", "LLM_PROVIDER", provider.getCode(), auth);
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
        model.setDescription(body.get("description"));
        model.setLogoUrl(safeLogoUrl(body.get("logoUrl")));

        ModeleLlm saved = models.save(model);

        audit("CREATE", "LLM_MODEL", saved.getAliasInterne(), auth);

        return toModelResponse(saved);
    }

    @PatchMapping("/{id}")
    @Transactional
    public AdminModelResponse updateModel(@PathVariable Long id, @RequestBody Map<String, String> body, JwtAuthenticationToken auth) {
        ModeleLlm model = models.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Model not found"));
        if (body.containsKey("providerId")) {
            Long providerId = Long.valueOf(required(body, "providerId"));
            model.setFournisseur(providers.findById(providerId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Provider not found")));
        }
        if (body.containsKey("providerModel")) model.setNomModeleProvider(required(body, "providerModel"));
        if (body.containsKey("displayName")) model.setNomAffichage(required(body, "displayName"));
        if (body.containsKey("description")) model.setDescription(blankToNull(body.get("description")));
        if (body.containsKey("logoUrl")) model.setLogoUrl(safeLogoUrl(body.get("logoUrl")));
        if (body.containsKey("status")) model.setStatut(status(body.get("status"), model.getStatut()));
        models.save(model);
        audit("UPDATE", "LLM_MODEL", model.getAliasInterne(), auth);
        return toModelResponse(model);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void deleteModel(@PathVariable Long id, JwtAuthenticationToken auth) {
        ModeleLlm model = models.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Model not found"));
        long references = conversations.countByModele_Id(id) + userRestrictions.countByLlmModelAlias(model.getAliasInterne()) + roleRestrictions.countByLlmModelAlias(model.getAliasInterne());
        if (references > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce modèle est utilisé par " + references + " références et ne peut pas être supprimé. Vous pouvez le désactiver.");
        models.delete(model);
        audit("DELETE", "LLM_MODEL", model.getAliasInterne(), auth);
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
                    "message", "Échec du test de connexion"
            );
        }
    }

    private AdminProviderResponse toProviderResponse(FournisseurLlm provider) {
        return new AdminProviderResponse(
                provider.getId(),
                provider.getCode(),
                provider.getNom(),
                provider.getStatut().name(),
                provider.getApiKeyEnvVar(),
                isApiKeyConfigured(provider.getApiKeyEnvVar())
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
                provider.getStatut().name(),
                model.getDescription(),
                model.getLogoUrl()
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

    private String apiKeyEnvVar(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) return null;
        if (!normalized.matches("[A-Z][A-Z0-9_]{1,99}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "apiKeyEnvVar must be an uppercase environment variable name");
        }
        return normalized;
    }

    private boolean isApiKeyConfigured(String envVar) {
        String value = envVar == null ? null : environment.getProperty(envVar);
        return value != null && !value.isBlank() && !value.startsWith("your_");
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
            String statut,
            String apiKeyEnvVar,
            boolean apiKeyConfigured
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
            String providerStatus,
            String description,
            String logoUrl
    ) {
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private String safeLogoUrl(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) return null;
        try {
            URI uri = URI.create(normalized);
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                throw new IllegalArgumentException("Unsupported logo URL scheme");
            }
            return normalized;
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Logo URL must use http or https");
        }
    }
}
