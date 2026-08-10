package com.example.backend.service;

import com.example.backend.entity.Utilisateur;
import com.example.backend.repository.UtilisateurRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Component
public class CurrentUserService {

    private final UtilisateurRepository utilisateurRepository;

    public CurrentUserService(UtilisateurRepository utilisateurRepository) {
        this.utilisateurRepository = utilisateurRepository;
    }

    // User resolution may create the local user record even when called by a
    // read-only conversation query. Keep that write in its own transaction so
    // PostgreSQL does not reject it as an INSERT inside the caller's
    // read-only transaction.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Utilisateur resolve(Jwt jwt) {
        String externalId = jwt.getSubject();
        return utilisateurRepository.findByExternalId(externalId)
                .orElseGet(() -> utilisateurRepository.save(
                        new Utilisateur(externalId, displayNameFrom(jwt))
                ));
    }

    public UUID keycloakId(Jwt jwt) {
        String subject = jwt == null ? null : jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, "Authenticated user identity is missing");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(UNAUTHORIZED, "Authenticated user identity is invalid", exception);
        }
    }

    public List<String> roles(Jwt jwt) {
        if (jwt == null) {
            return List.of();
        }
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null || !(realmAccess.get("roles") instanceof Collection<?> rawRoles)) {
            return List.of();
        }
        return rawRoles.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .map(String::trim)
                .filter(role -> !role.isBlank())
                .map(String::toUpperCase)
                .distinct()
                .toList();
    }

    private String displayNameFrom(Jwt jwt) {
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.isBlank()) return name;
        String preferredUsername = jwt.getClaimAsString("preferred_username");
        if (preferredUsername != null && !preferredUsername.isBlank()) return preferredUsername;
        return "Utilisateur";
    }
}
