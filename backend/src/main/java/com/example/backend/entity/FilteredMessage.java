package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "filtered_messages")
public class FilteredMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_keycloak_id", nullable = false)
    private UUID userKeycloakId;

    @Column(name = "original_content", nullable = false, columnDefinition = "TEXT")
    @JsonIgnore
    private String originalContent;

    @Column(name = "redacted_content", columnDefinition = "TEXT")
    private String redactedContent;

    @Column(nullable = false)
    private String action; // "BLOCKED" or "REDACTED"

    @Column(nullable = false)
    private String reason;

    @Column(name = "highest_severity")
    private String highestSeverity;
    @Column(name = "detected_types", columnDefinition = "TEXT")
    private String detectedTypes;
    @Column(name = "detection_count", nullable = false)
    private Integer detectionCount = 0;
    @Column(name = "request_status", nullable = false)
    private String requestStatus = "FAILED";

    @Column(nullable = false, updatable = false)
    private Instant timestamp = Instant.now();

    public FilteredMessage() {}

    public FilteredMessage(UUID userKeycloakId, String originalContent, String redactedContent, String action, String reason) {
        this.userKeycloakId = userKeycloakId;
        this.originalContent = originalContent;
        this.redactedContent = redactedContent;
        this.action = action;
        this.reason = reason;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UUID getUserKeycloakId() { return userKeycloakId; }
    public void setUserKeycloakId(UUID userKeycloakId) { this.userKeycloakId = userKeycloakId; }
    public String getOriginalContent() { return originalContent; }
    public void setOriginalContent(String originalContent) { this.originalContent = originalContent; }
    public String getRedactedContent() { return redactedContent; }
    public void setRedactedContent(String redactedContent) { this.redactedContent = redactedContent; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getHighestSeverity() { return highestSeverity; }
    public void setHighestSeverity(String highestSeverity) { this.highestSeverity = highestSeverity; }
    public String getDetectedTypes() { return detectedTypes; }
    public void setDetectedTypes(String detectedTypes) { this.detectedTypes = detectedTypes; }
    public Integer getDetectionCount() { return detectionCount; }
    public void setDetectionCount(Integer detectionCount) { this.detectionCount = detectionCount; }
    public String getRequestStatus() { return requestStatus; }
    public void setRequestStatus(String requestStatus) { this.requestStatus = requestStatus; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
