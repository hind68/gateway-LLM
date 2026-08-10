package com.example.backend.entity;

import com.example.backend.enums.RoleMessage;
import com.example.backend.enums.StatutMessage;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "message")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoleMessage role;

    @Column(nullable = false)
    private Integer ordre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutMessage statut;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenu;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reponse_a_message_id")
    private Message reponseA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modele_llm_id")
    private ModeleLlm modele;

    @Column(name = "dlp_highest_severity", length = 20)
    private String dlpHighestSeverity;

    @Column(name = "dlp_detected_types", columnDefinition = "TEXT")
    private String dlpDetectedTypes;

    @Column(name = "dlp_matches_json", columnDefinition = "TEXT")
    private String dlpMatches;

    @Column(name = "dlp_masked_text", columnDefinition = "TEXT")
    private String dlpMaskedText;

    @Column(name = "attachment_metadata_json", columnDefinition = "TEXT")
    private String attachmentMetadataJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Message() {
    }

    public Message(Conversation conversation, RoleMessage role, Integer ordre, StatutMessage statut, String contenu, Message reponseA) {
        this(conversation, role, ordre, statut, contenu, reponseA, null);
    }

    public Message(Conversation conversation, RoleMessage role, Integer ordre, StatutMessage statut, String contenu, Message reponseA, ModeleLlm modele) {
        this.conversation = conversation;
        this.role = role;
        this.ordre = ordre;
        this.statut = statut;
        this.contenu = contenu;
        this.reponseA = reponseA;
        this.modele = modele;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void complete(String contenu) {
        this.contenu = contenu;
        this.statut = StatutMessage.TERMINE;
    }

    public void fail(String contenu) {
        this.contenu = contenu;
        this.statut = StatutMessage.ECHEC;
    }

    public void blockByDlp(String highestSeverity, String detectedTypes) {
        blockByDlp(highestSeverity, detectedTypes, null, null);
    }

    public void blockByDlp(String highestSeverity, String detectedTypes, String matches) {
        blockByDlp(highestSeverity, detectedTypes, matches, null);
    }

    public void blockByDlp(String highestSeverity, String detectedTypes, String matches, String maskedText) {
        this.statut = StatutMessage.DLP_BLOCKED;
        this.dlpHighestSeverity = highestSeverity;
        this.dlpDetectedTypes = detectedTypes;
        this.dlpMatches = matches;
        this.dlpMaskedText = maskedText;
    }

    public void setAttachmentMetadataJson(String attachmentMetadataJson) {
        this.attachmentMetadataJson = attachmentMetadataJson;
    }

    public Long getId() {
        return id;
    }

    public Conversation getConversation() {
        return conversation;
    }

    public RoleMessage getRole() {
        return role;
    }

    public Integer getOrdre() {
        return ordre;
    }

    public StatutMessage getStatut() {
        return statut;
    }

    public String getContenu() {
        return contenu;
    }

    public Message getReponseA() {
        return reponseA;
    }

    public ModeleLlm getModele() {
        return modele;
    }

    public String getDlpHighestSeverity() {
        return dlpHighestSeverity;
    }

    public String getDlpDetectedTypes() {
        return dlpDetectedTypes;
    }

    public String getDlpMatches() {
        return dlpMatches;
    }

    public String getDlpMaskedText() {
        return dlpMaskedText;
    }

    public String getAttachmentMetadataJson() {
        return attachmentMetadataJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}


