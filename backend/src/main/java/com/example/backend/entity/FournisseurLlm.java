package com.example.backend.entity;

import com.example.backend.enums.StatutFournisseurLlm;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "fournisseur_llm")
public class FournisseurLlm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 100)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutFournisseurLlm statut;

    @Column(name = "api_key_env_var", length = 100)
    private String apiKeyEnvVar;

    @OneToMany(mappedBy = "fournisseur", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<ModeleLlm> modeles = new LinkedHashSet<>();

    protected FournisseurLlm() {
    }

    public FournisseurLlm(String code, String nom, StatutFournisseurLlm statut) {
        this.code = code;
        this.nom = nom;
        this.statut = statut;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getNom() {
        return nom;
    }

    public StatutFournisseurLlm getStatut() {
        return statut;
    }

    public void setCode(String code) { this.code = code; }
    public void setNom(String nom) { this.nom = nom; }
    public void setStatut(StatutFournisseurLlm statut) { this.statut = statut; }
    public String getApiKeyEnvVar() { return apiKeyEnvVar; }
    public void setApiKeyEnvVar(String apiKeyEnvVar) { this.apiKeyEnvVar = apiKeyEnvVar; }

    public Set<ModeleLlm> getModeles() {
        return modeles;
    }
}


