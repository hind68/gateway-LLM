package com.example.backend.entity;

import com.example.backend.enums.StatutModeleLlm;
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
import jakarta.persistence.Table;

@Entity
@Table(name = "modele_llm")
public class ModeleLlm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fournisseur_llm_id", nullable = false)
    private FournisseurLlm fournisseur;

    @Column(name = "alias_interne", nullable = false, unique = true, length = 100)
    private String aliasInterne;

    @Column(name = "nom_modele_provider", nullable = false, length = 150)
    private String nomModeleProvider;

    @Column(name = "nom_affichage", nullable = false, length = 100)
    private String nomAffichage;

    @Column(length = 500)
    private String description;

    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutModeleLlm statut;

    protected ModeleLlm() {
    }

    public ModeleLlm(FournisseurLlm fournisseur, String aliasInterne, String nomModeleProvider, String nomAffichage, StatutModeleLlm statut) {
        this.fournisseur = fournisseur;
        this.aliasInterne = aliasInterne;
        this.nomModeleProvider = nomModeleProvider;
        this.nomAffichage = nomAffichage;
        this.statut = statut;
    }

    public Long getId() {
        return id;
    }

    public FournisseurLlm getFournisseur() {
        return fournisseur;
    }

    public String getAliasInterne() {
        return aliasInterne;
    }

    public String getNomModeleProvider() {
        return nomModeleProvider;
    }

    public String getNomAffichage() {
        return nomAffichage;
    }

    public String getDescription() { return description; }
    public String getLogoUrl() { return logoUrl; }

    public StatutModeleLlm getStatut() {
        return statut;
    }

    public void setFournisseur(FournisseurLlm fournisseur) { this.fournisseur = fournisseur; }
    public void setAliasInterne(String aliasInterne) { this.aliasInterne = aliasInterne; }
    public void setNomModeleProvider(String nomModeleProvider) { this.nomModeleProvider = nomModeleProvider; }
    public void setNomAffichage(String nomAffichage) { this.nomAffichage = nomAffichage; }
    public void setDescription(String description) { this.description = description; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public void setStatut(StatutModeleLlm statut) { this.statut = statut; }
}


