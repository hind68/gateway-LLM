package com.example.backend.controller;

import com.example.backend.entity.AuditLog;
import com.example.backend.integration.keycloak.KeycloakAdminClient;
import com.example.backend.repository.AuditLogRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/keycloak")
@PreAuthorize("hasRole('ADMIN')")
public class KeycloakAdminController {
    private final KeycloakAdminClient keycloak;
    private final AuditLogRepository auditLogs;

    public KeycloakAdminController(KeycloakAdminClient keycloak, AuditLogRepository auditLogs) {
        this.keycloak = keycloak;
        this.auditLogs = auditLogs;
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users(@RequestParam(required = false) String search) {
        return keycloak.users(search);
    }

    @PostMapping("/users")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public void createUser(@RequestBody Map<String, Object> payload, JwtAuthenticationToken auth) {
        keycloak.createUser(payload);
        audit("CREATE", "KEYCLOAK_USER", String.valueOf(payload.get("username")), auth);
    }

    @PatchMapping("/users/{id}/enabled")
    public void setEnabled(@PathVariable String id, @RequestParam boolean enabled, JwtAuthenticationToken auth) {
        keycloak.setEnabled(id, enabled);
        audit(enabled ? "ENABLE" : "DISABLE", "KEYCLOAK_USER", id, auth);
    }

    @GetMapping("/roles")
    public List<Map<String, Object>> roles() { return keycloak.roles(); }

    @GetMapping("/users/{id}/roles")
    public List<Map<String, Object>> userRoles(@PathVariable String id) { return keycloak.userRealmRoles(id); }

    @PutMapping("/users/{id}/roles")
    public void setRoles(@PathVariable String id, @RequestBody Map<String, List<String>> payload, JwtAuthenticationToken auth) {
        keycloak.setRealmRoles(id, payload.getOrDefault("roles", List.of()));
        audit("UPDATE_ROLES", "KEYCLOAK_USER", id, auth);
    }

    private void audit(String action, String entity, String id, JwtAuthenticationToken auth) {
        auditLogs.save(new AuditLog(action, entity, id, UUID.fromString(auth.getToken().getSubject())));
    }
}
