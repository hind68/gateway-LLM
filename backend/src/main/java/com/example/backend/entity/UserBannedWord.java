package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_banned_words")
public class UserBannedWord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_keycloak_id", nullable = false)
    private UUID userKeycloakId;

    @Column(nullable = false)
    private String word;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    protected UserBannedWord() {}

    public UserBannedWord(UUID userKeycloakId, String word, UUID createdBy) {
        this.userKeycloakId = userKeycloakId;
        this.word = word;
        this.createdBy = createdBy;
    }

    public Long getId() { return id; }
    public UUID getUserKeycloakId() { return userKeycloakId; }
    public String getWord() { return word; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCreatedBy() { return createdBy; }
}