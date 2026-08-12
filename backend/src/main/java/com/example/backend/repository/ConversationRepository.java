package com.example.backend.repository;

import com.example.backend.entity.Conversation;
import com.example.backend.enums.StatutConversation;
import com.example.backend.entity.Utilisateur;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    long countByModele_Id(Long modelId);

    @Query(
            value = """
            select c
            from Conversation c
            join fetch c.modele m
            where c.utilisateur = :utilisateur
              and c.statut = :statut
              and (
                :modelAlias is null
                or m.aliasInterne = :modelAlias
                or exists (
                  select 1
                  from Message msg
                  join msg.modele msgModel
                  where msg.conversation = c
                    and msg.role = com.example.backend.enums.RoleMessage.ASSISTANT
                    and msgModel.aliasInterne = :modelAlias
                )
              )
              and (:searchPattern is null or lower(c.titre) like :searchPattern)
            """,
            countQuery = """
            select count(c)
            from Conversation c
            join c.modele m
            where c.utilisateur = :utilisateur
              and c.statut = :statut
              and (
                :modelAlias is null
                or m.aliasInterne = :modelAlias
                or exists (
                  select 1
                  from Message msg
                  join msg.modele msgModel
                  where msg.conversation = c
                    and msg.role = com.example.backend.enums.RoleMessage.ASSISTANT
                    and msgModel.aliasInterne = :modelAlias
                )
              )
              and (:searchPattern is null or lower(c.titre) like :searchPattern)
            """
    )
    Page<Conversation> search(
            @Param("utilisateur") Utilisateur utilisateur,
            @Param("statut") StatutConversation statut,
            @Param("modelAlias") String modelAlias,
            @Param("searchPattern") String searchPattern,
            Pageable pageable
    );

    @Query("""
            select c
            from Conversation c
            join fetch c.modele
            join fetch c.utilisateur
            where c.id = :id
              and c.utilisateur = :utilisateur
            """)
    Optional<Conversation> findOwnedById(@Param("id") Long id, @Param("utilisateur") Utilisateur utilisateur);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from Conversation c
            where c.id = :id
              and c.utilisateur = :utilisateur
            """)
    int deleteOwnedById(@Param("id") Long id, @Param("utilisateur") Utilisateur utilisateur);
}

