package com.example.backend.entity; // Ensure this matches your package structure

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_llm_restrictions")
public class UserLlmRestriction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Explicitly mapping to the Flyway column name and using UUID
    @Column(name = "user_keycloak_id", nullable = false)
    private UUID userKeycloakId;

    @Column(name = "llm_model_alias", nullable = false)
    private String llmModelAlias;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    public UserLlmRestriction() {}

    public UserLlmRestriction(UUID userKeycloakId, String llmModelAlias, UUID createdBy) {
        this.userKeycloakId = userKeycloakId;
        this.llmModelAlias = llmModelAlias;
        this.createdBy = createdBy;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UUID getUserKeycloakId() { return userKeycloakId; }
    public void setUserKeycloakId(UUID userKeycloakId) { this.userKeycloakId = userKeycloakId; }

    public String getLlmModelAlias() { return llmModelAlias; }
    public void setLlmModelAlias(String llmModelAlias) { this.llmModelAlias = llmModelAlias; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}