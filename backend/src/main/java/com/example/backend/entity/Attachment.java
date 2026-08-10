package com.example.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "attachment")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "mime_type", nullable = false, length = 160)
    private String mimeType;

    @Column(nullable = false)
    private long size;

    @Column(name = "dlp_decision", nullable = false, length = 20)
    private String dlpDecision;

    @Column(name = "extraction_status", nullable = false, length = 80)
    private String extractionStatus;

    @Column(name = "extracted_text", columnDefinition = "TEXT")
    private String extractedText;

    @Column(name = "masked_text", columnDefinition = "TEXT")
    private String maskedText;

    @Column(name = "matches_json", columnDefinition = "TEXT")
    private String matchesJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Attachment() {
    }

    public Attachment(
            Message message,
            String originalFilename,
            String storageKey,
            String mimeType,
            long size,
            String dlpDecision,
            String extractionStatus,
            String extractedText,
            String maskedText,
            String matchesJson
    ) {
        this.message = message;
        this.originalFilename = originalFilename;
        this.storageKey = storageKey;
        this.mimeType = mimeType;
        this.size = size;
        this.dlpDecision = dlpDecision;
        this.extractionStatus = extractionStatus;
        this.extractedText = extractedText;
        this.maskedText = maskedText;
        this.matchesJson = matchesJson;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Message getMessage() {
        return message;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getMimeType() {
        return mimeType;
    }

    public long getSize() {
        return size;
    }

    public String getDlpDecision() {
        return dlpDecision;
    }

    public String getExtractionStatus() {
        return extractionStatus;
    }

    public String getExtractedText() {
        return extractedText;
    }

    public String getMaskedText() {
        return maskedText;
    }

    public void setMaskedText(String maskedText) {
        this.maskedText = maskedText;
    }

    public String getMatchesJson() {
        return matchesJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
