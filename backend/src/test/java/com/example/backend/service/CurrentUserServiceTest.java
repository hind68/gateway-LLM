package com.example.backend.service;

import com.example.backend.entity.Utilisateur;
import com.example.backend.repository.UtilisateurRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CurrentUserServiceTest {

    @Mock
    private UtilisateurRepository utilisateurRepository;

    @InjectMocks
    private CurrentUserService currentUserService;

    @Test
    void resolveReturnsExistingUserForJwtSubject() {
        Jwt jwt = jwt("user-123", "Alice");
        Utilisateur existing = new Utilisateur("user-123", "Alice");
        when(utilisateurRepository.findByExternalId("user-123")).thenReturn(Optional.of(existing));

        assertThat(currentUserService.resolve(jwt)).isSameAs(existing);
        verify(utilisateurRepository).findByExternalId("user-123");
    }

    @Test
    void resolveCreatesUserUsingDisplayNameClaimWhenSubjectIsNew() {
        Jwt jwt = jwt("user-456", "Bob");
        when(utilisateurRepository.findByExternalId("user-456")).thenReturn(Optional.empty());
        when(utilisateurRepository.save(any(Utilisateur.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Utilisateur resolved = currentUserService.resolve(jwt);

        assertThat(resolved.getExternalId()).isEqualTo("user-456");
        assertThat(resolved.getNomAffichage()).isEqualTo("Bob");
        verify(utilisateurRepository).save(any(Utilisateur.class));
    }

    @Test
    void resolveFallsBackToPreferredUsernameThenDefaultDisplayName() {
        Jwt preferredUsernameJwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-789")
                .claim("preferred_username", "charlie")
                .build();
        when(utilisateurRepository.findByExternalId("user-789")).thenReturn(Optional.empty());
        when(utilisateurRepository.save(any(Utilisateur.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Utilisateur preferred = currentUserService.resolve(preferredUsernameJwt);

        assertThat(preferred.getNomAffichage()).isEqualTo("charlie");

        Jwt defaultJwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-999")
                .build();
        when(utilisateurRepository.findByExternalId("user-999")).thenReturn(Optional.empty());

        Utilisateur fallback = currentUserService.resolve(defaultJwt);

        assertThat(fallback.getNomAffichage()).isEqualTo("Utilisateur");
    }

    @Test
    void resolveUsesIndependentWriteTransactionForReadOnlyCallers() throws NoSuchMethodException {
        Transactional transactional = CurrentUserService.class
                .getMethod("resolve", Jwt.class)
                .getAnnotation(Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }

    @Test
    void keycloakIdReturnsUuidSubject() {
        String subject = "123e4567-e89b-12d3-a456-426614174000";

        assertThat(currentUserService.keycloakId(jwt(subject, "Alice")))
                .isEqualTo(java.util.UUID.fromString(subject));
    }

    @Test
    void keycloakIdRejectsMissingOrNonUuidSubject() {
        Jwt invalid = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("not-a-uuid")
                .build();

        assertThatThrownBy(() -> currentUserService.keycloakId(invalid))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Authenticated user identity is invalid");
        assertThatThrownBy(() -> currentUserService.keycloakId(null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Authenticated user identity is missing");
    }

    private Jwt jwt(String subject, String name) {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(subject)
                .claim("name", name)
                .build();
    }
}
