package com.example.backend.service;

import com.example.backend.repository.GlobalBannedWordRepository;
import com.example.backend.repository.UserBannedWordRepository;
import com.example.backend.repository.UserLlmRestrictionRepository;
import com.example.backend.repository.RoleBannedWordRepository;
import com.example.backend.repository.RoleLlmRestrictionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ChatValidationService {

    private final UserLlmRestrictionRepository llmRestrictionRepo;
    private final GlobalBannedWordRepository globalBannedWordRepo;
    private final UserBannedWordRepository userBannedWordRepo;
    private final RoleLlmRestrictionRepository roleLlmRestrictionRepo;
    private final RoleBannedWordRepository roleBannedWordRepo;

    public ChatValidationService(
            UserLlmRestrictionRepository llmRestrictionRepo,
            GlobalBannedWordRepository globalBannedWordRepo,
            UserBannedWordRepository userBannedWordRepo,
            RoleLlmRestrictionRepository roleLlmRestrictionRepo,
            RoleBannedWordRepository roleBannedWordRepo
    ) {
        this.llmRestrictionRepo = llmRestrictionRepo;
        this.globalBannedWordRepo = globalBannedWordRepo;
        this.userBannedWordRepo = userBannedWordRepo;
        this.roleLlmRestrictionRepo = roleLlmRestrictionRepo;
        this.roleBannedWordRepo = roleBannedWordRepo;
    }

    public void validateLlmAccess(UUID userId, String llmModelAlias) {
        validateLlmAccess(userId, llmModelAlias, List.of());
    }

    public void validateLlmAccess(UUID userId, String llmModelAlias, Collection<String> roles) {
        boolean userRestricted = llmRestrictionRepo.existsByUserKeycloakIdAndLlmModelAlias(userId, llmModelAlias);
        boolean roleRestricted = roles != null && roles.stream()
                .map(String::toUpperCase)
                .anyMatch(role -> roleLlmRestrictionRepo.findByRoleName(role).stream()
                        .anyMatch(restriction -> llmModelAlias.equals(restriction.getLlmModelAlias())));
        if (userRestricted || roleRestricted) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User " + userId + " is not permitted to use model '" + llmModelAlias + "'");
        }
    }

    public boolean isLlmAllowed(UUID userId, String llmModelAlias, Collection<String> roles) {
        if (roles != null && roles.stream().map(String::toUpperCase).anyMatch("ADMIN"::equals)) {
            return true;
        }
        try {
            validateLlmAccess(userId, llmModelAlias, roles);
            return true;
        } catch (ResponseStatusException denied) {
            return false;
        }
    }

    public List<String> getBannedWords(UUID userId) {
        return getBannedWords(userId, List.of());
    }

    public List<String> getBannedWords(UUID userId, Collection<String> roles) {
        Set<String> bannedWords = new LinkedHashSet<>(globalBannedWordRepo.findAllWords());
        bannedWords.addAll(userBannedWordRepo.findWordsByUserKeycloakId(userId));
        if (roles != null) {
            roles.stream()
                    .map(String::toUpperCase)
                    .distinct()
                    .flatMap(role -> roleBannedWordRepo.findByRoleName(role).stream())
                    .map(roleWord -> roleWord.getWord().trim())
                    .filter(word -> !word.isBlank())
                    .forEach(bannedWords::add);
        }
        return List.copyOf(bannedWords);
    }
}
