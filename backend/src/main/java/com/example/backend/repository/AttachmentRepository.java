package com.example.backend.repository;

import com.example.backend.entity.Attachment;
import com.example.backend.entity.Conversation;
import com.example.backend.entity.Message;
import com.example.backend.entity.Utilisateur;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByMessage(Message message);

    @Query("""
            select a
            from Attachment a
            join fetch a.message m
            join fetch m.conversation c
            join fetch c.utilisateur
            where a.id = :id
              and c.utilisateur = :user
            """)
    Optional<Attachment> findOwnedById(@Param("id") Long id, @Param("user") Utilisateur user);

    @Query("""
            select a
            from Attachment a
            join fetch a.message m
            where m.conversation = :conversation
            """)
    List<Attachment> findByConversation(@Param("conversation") Conversation conversation);
}
