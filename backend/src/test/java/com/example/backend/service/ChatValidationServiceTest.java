package com.example.backend.service;

import com.example.backend.entity.RoleBannedWord;
import com.example.backend.entity.RoleLlmRestriction;
import com.example.backend.repository.GlobalBannedWordRepository;
import com.example.backend.repository.RoleBannedWordRepository;
import com.example.backend.repository.RoleLlmRestrictionRepository;
import com.example.backend.repository.UserBannedWordRepository;
import com.example.backend.repository.UserLlmRestrictionRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatValidationServiceTest {

    private static final UUID USER_ID = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");

    @Mock UserLlmRestrictionRepository userLlmRestrictionRepository;
    @Mock GlobalBannedWordRepository globalBannedWordRepository;
    @Mock UserBannedWordRepository userBannedWordRepository;
    @Mock RoleLlmRestrictionRepository roleLlmRestrictionRepository;
    @Mock RoleBannedWordRepository roleBannedWordRepository;

    @InjectMocks ChatValidationService service;

    @Test
    void roleRestrictionBlocksModelAccess() {
        RoleLlmRestriction restriction = new RoleLlmRestriction();
        restriction.setLlmModelAlias("secure-groq");
        when(userLlmRestrictionRepository.existsByUserKeycloakIdAndLlmModelAlias(USER_ID, "secure-groq"))
                .thenReturn(false);
        when(roleLlmRestrictionRepository.findByRoleName("STUDENT")).thenReturn(List.of(restriction));

        assertThatThrownBy(() -> service.validateLlmAccess(USER_ID, "secure-groq", List.of("student")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not permitted");
    }

    @Test
    void bannedWordsMergeGlobalUserAndRolePolicies() {
        RoleBannedWord roleWord = new RoleBannedWord();
        roleWord.setWord(" secret ");
        when(globalBannedWordRepository.findAllWords()).thenReturn(List.of("global"));
        when(userBannedWordRepository.findWordsByUserKeycloakId(USER_ID)).thenReturn(List.of("user"));
        when(roleBannedWordRepository.findByRoleName("MANAGER")).thenReturn(List.of(roleWord));

        assertThat(service.getBannedWords(USER_ID, List.of("manager")))
                .containsExactly("global", "user", "secret");
    }
}
