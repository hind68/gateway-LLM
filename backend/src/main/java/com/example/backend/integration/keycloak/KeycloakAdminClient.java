package com.example.backend.integration.keycloak;

import com.example.backend.exceptions.DlpUnavailableException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class KeycloakAdminClient {
    private final WebClient client;
    private final String adminRealm;
    private final String realm;
    private final String clientId;
    private final String clientSecret;
    private final Duration timeout = Duration.ofSeconds(10);

    public KeycloakAdminClient(
            @Value("${keycloak.admin.base-url:http://127.0.0.1:8080}") String baseUrl,
            @Value("${keycloak.admin.realm:synapse}") String realm,
            @Value("${keycloak.admin.token-realm:synapse}") String adminRealm,
            @Value("${keycloak.admin.client-id:gateway-admin}") String clientId,
            @Value("${keycloak.admin.client-secret:}") String clientSecret
    ) {
        this.client = WebClient.builder().baseUrl(baseUrl).build();
        this.realm = realm;
        this.adminRealm = adminRealm;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public List<Map<String, Object>> users(String search) {
        return client.get().uri(uri -> uri.path("/admin/realms/{realm}/users").queryParam("max", 200)
                        .queryParamIfPresent("search", java.util.Optional.ofNullable(blankToNull(search))).build(realm))
                .headers(headers -> headers.setBearerAuth(adminToken()))
                .retrieve().bodyToFlux(Map.class).map(value -> (Map<String, Object>) value).collectList().block(timeout);
    }

    public void createUser(Map<String, Object> payload) {
        client.post().uri("/admin/realms/{realm}/users", realm).headers(headers -> headers.setBearerAuth(adminToken())).contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload).retrieve().toBodilessEntity().block(timeout);
    }

    public void setEnabled(String userId, boolean enabled) {
        client.put().uri("/admin/realms/{realm}/users/{id}", realm, userId).headers(headers -> headers.setBearerAuth(adminToken()))
                .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("enabled", enabled))
                .retrieve().toBodilessEntity().block(timeout);
    }

    public List<Map<String, Object>> roles() {
        return client.get().uri("/admin/realms/{realm}/roles", realm).headers(headers -> headers.setBearerAuth(adminToken()))
                .retrieve().bodyToFlux(Map.class).map(value -> (Map<String, Object>) value).collectList().block(timeout);
    }

    public List<Map<String, Object>> userRealmRoles(String userId) {
        return client.get().uri("/admin/realms/{realm}/users/{id}/role-mappings/realm", realm, userId)
                .headers(headers -> headers.setBearerAuth(adminToken()))
                .retrieve().bodyToFlux(Map.class).map(value -> (Map<String, Object>) value).collectList().block(timeout);
    }

    public void setRealmRoles(String userId, List<String> roleNames) {
        List<Map<String, Object>> roleRepresentations = roles().stream()
                .filter(role -> roleNames.contains(String.valueOf(role.get("name"))))
                .map(role -> Map.of("id", role.get("id"), "name", role.get("name")))
                .toList();
        List<Map<String, Object>> current = userRealmRoles(userId);
        List<Map<String, Object>> toRemove = current.stream()
                .filter(role -> !roleNames.contains(String.valueOf(role.get("name"))))
                .map(role -> Map.of("id", role.get("id"), "name", role.get("name")))
                .toList();
        if (!toRemove.isEmpty()) {
            client.method(org.springframework.http.HttpMethod.DELETE)
                    .uri("/admin/realms/{realm}/users/{id}/role-mappings/realm", realm, userId)
                    .headers(headers -> headers.setBearerAuth(adminToken()))
                    .contentType(MediaType.APPLICATION_JSON).bodyValue(toRemove)
                    .retrieve().toBodilessEntity().block(timeout);
        }
        List<String> currentNames = current.stream().map(role -> String.valueOf(role.get("name"))).toList();
        List<Map<String, Object>> toAdd = roleRepresentations.stream()
                .filter(role -> !currentNames.contains(String.valueOf(role.get("name"))))
                .toList();
        if (!toAdd.isEmpty()) {
            client.post().uri("/admin/realms/{realm}/users/{id}/role-mappings/realm", realm, userId).headers(headers -> headers.setBearerAuth(adminToken()))
                    .contentType(MediaType.APPLICATION_JSON).bodyValue(toAdd)
                    .retrieve().toBodilessEntity().block(timeout);
        }
    }

    private String adminToken() {
        try {
            Map<String, Object> token = client.post()
                    .uri("/realms/{realm}/protocol/openid-connect/token", adminRealm)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue("grant_type=client_credentials&client_id=" + clientId + "&client_secret=" + clientSecret)
                    .retrieve().bodyToMono(Map.class).block(timeout);
            String accessToken = String.valueOf(token.get("access_token"));
            return accessToken;
        } catch (RuntimeException exception) {
            throw new DlpUnavailableException("Keycloak administration is unavailable", exception);
        }
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
}
