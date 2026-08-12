package com.example.backend.repository;

import com.example.backend.entity.ModeleLlm;
import com.example.backend.enums.StatutModeleLlm;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModeleLlmRepository extends JpaRepository<ModeleLlm, Long> {

    List<ModeleLlm> findByStatutOrderByIdAsc(StatutModeleLlm statut);

    List<ModeleLlm> findByStatutAndFournisseur_StatutOrderByIdAsc(StatutModeleLlm modelStatus, com.example.backend.enums.StatutFournisseurLlm providerStatus);

    Optional<ModeleLlm> findByAliasInterneAndStatut(String aliasInterne, StatutModeleLlm statut);

    Optional<ModeleLlm> findByAliasInterneAndStatutAndFournisseur_Statut(String aliasInterne, StatutModeleLlm modelStatus, com.example.backend.enums.StatutFournisseurLlm providerStatus);

    boolean existsByAliasInterneAndStatut(String aliasInterne, StatutModeleLlm statut);
}

