package com.example.backend.repository;

import com.example.backend.entity.UserLlmRestriction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface UserLlmRestrictionRepository extends JpaRepository<UserLlmRestriction, Long> {
    List<UserLlmRestriction> findByUserKeycloakId(UUID userKeycloakId);
    boolean existsByUserKeycloakIdAndLlmModelAlias(UUID userKeycloakId, String llmModelAlias);
}