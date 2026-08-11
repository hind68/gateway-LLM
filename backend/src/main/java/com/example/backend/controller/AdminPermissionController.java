package com.example.backend.controller;

import com.example.backend.entity.AuditLog;
import com.example.backend.entity.GlobalBannedWord;
import com.example.backend.entity.UserBannedWord;
import com.example.backend.entity.UserLlmRestriction;
import com.example.backend.entity.Utilisateur;
import com.example.backend.repository.AuditLogRepository;
import com.example.backend.repository.GlobalBannedWordRepository;
import com.example.backend.repository.UserBannedWordRepository;
import com.example.backend.repository.UserLlmRestrictionRepository;
import com.example.backend.repository.UtilisateurRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/permissions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPermissionController {

    private final GlobalBannedWordRepository globalBannedWordRepo;
    private final UserLlmRestrictionRepository userLlmRestrictionRepo;
    private final UserBannedWordRepository userBannedWordRepo;
    private final UtilisateurRepository utilisateurRepository;
    private final AuditLogRepository auditLogRepository;

    public AdminPermissionController(
            GlobalBannedWordRepository globalBannedWordRepo,
            UserLlmRestrictionRepository userLlmRestrictionRepo,
            UserBannedWordRepository userBannedWordRepo,
            UtilisateurRepository utilisateurRepository,
            AuditLogRepository auditLogRepository) {
        this.globalBannedWordRepo = globalBannedWordRepo;
        this.userLlmRestrictionRepo = userLlmRestrictionRepo;
        this.userBannedWordRepo = userBannedWordRepo;
        this.utilisateurRepository = utilisateurRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping("/users")
    public List<Utilisateur> getAllUsers(@AuthenticationPrincipal Jwt jwt) {
        return utilisateurRepository.findAll();
    }

    @GetMapping("/banned-words/global")
    public List<GlobalBannedWord> listGlobalBannedWords(@AuthenticationPrincipal Jwt jwt) {
        return globalBannedWordRepo.findAll();
    }

    @PostMapping("/banned-words/global")
    @Transactional
    public GlobalBannedWord addGlobalBannedWord(@RequestBody Map<String, String> payload, JwtAuthenticationToken auth) {
        UUID adminId = UUID.fromString(auth.getToken().getSubject());
        GlobalBannedWord saved = globalBannedWordRepo.save(new GlobalBannedWord(payload.get("word").trim(), adminId));
        auditLogRepository.save(new AuditLog("ADD", "GlobalBannedWord", saved.getWord(), adminId));
        return saved;
    }

    @DeleteMapping("/banned-words/global/{id}")
    @Transactional
    public void removeGlobalBannedWord(@PathVariable Long id, JwtAuthenticationToken auth) {
        if (!globalBannedWordRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Banned word not found");
        }
        UUID adminId = UUID.fromString(auth.getToken().getSubject());
        globalBannedWordRepo.deleteById(id);
        auditLogRepository.save(new AuditLog("DELETE", "GlobalBannedWord", String.valueOf(id), adminId));
    }

    @GetMapping("/llm-restrictions/{userKeycloakId}")
    public List<UserLlmRestriction> listUserRestrictions(@PathVariable UUID userKeycloakId, @AuthenticationPrincipal Jwt jwt) {
        return userLlmRestrictionRepo.findByUserKeycloakId(userKeycloakId);
    }

    @PostMapping("/llm-restrictions")
    @Transactional
    public UserLlmRestriction addLlmRestriction(@RequestBody Map<String, String> payload, JwtAuthenticationToken auth) {
        UUID adminId = UUID.fromString(auth.getToken().getSubject());
        UserLlmRestriction restriction = new UserLlmRestriction();
        restriction.setUserKeycloakId(UUID.fromString(payload.get("userId")));
        restriction.setLlmModelAlias(payload.get("llmModelAlias"));
        restriction.setCreatedBy(adminId);
        UserLlmRestriction saved = userLlmRestrictionRepo.save(restriction);
        auditLogRepository.save(new AuditLog("ADD", "UserLlmRestriction", saved.getLlmModelAlias(), adminId));
        return saved;
    }

    @DeleteMapping("/llm-restrictions/{id}")
    @Transactional
    public void removeLlmRestriction(@PathVariable Long id, JwtAuthenticationToken auth) {
        if (!userLlmRestrictionRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Restriction not found");
        }
        UUID adminId = UUID.fromString(auth.getToken().getSubject());
        userLlmRestrictionRepo.deleteById(id);
        auditLogRepository.save(new AuditLog("DELETE", "UserLlmRestriction", String.valueOf(id), adminId));
    }

    @GetMapping("/banned-words/user/{userKeycloakId}")
    public List<UserBannedWord> listUserBannedWords(@PathVariable UUID userKeycloakId, @AuthenticationPrincipal Jwt jwt) {
        return userBannedWordRepo.findByUserKeycloakId(userKeycloakId);
    }

    @PostMapping("/banned-words/user")
    @Transactional
    public UserBannedWord addUserBannedWord(@RequestBody Map<String, String> payload, JwtAuthenticationToken auth) {
        UUID targetUserId = UUID.fromString(payload.get("userId"));
        String word = payload.get("word").trim().toLowerCase();
        UUID adminId = UUID.fromString(auth.getToken().getSubject());
        UserBannedWord saved = userBannedWordRepo.save(new UserBannedWord(targetUserId, word, adminId));
        auditLogRepository.save(new AuditLog("ADD", "UserBannedWord", word, adminId));
        return saved;
    }

    @DeleteMapping("/banned-words/user/{id}")
    @Transactional
    public void removeUserBannedWord(@PathVariable Long id, JwtAuthenticationToken auth) {
        if (!userBannedWordRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Banned word not found");
        }
        UUID adminId = UUID.fromString(auth.getToken().getSubject());
        userBannedWordRepo.deleteById(id);
        auditLogRepository.save(new AuditLog("DELETE", "UserBannedWord", String.valueOf(id), adminId));
    }
}
