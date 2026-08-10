package com.example.backend.repository;

import com.example.backend.entity.UserBannedWord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface UserBannedWordRepository extends JpaRepository<UserBannedWord, Long> {
    @Query("SELECT u.word FROM UserBannedWord u WHERE u.userKeycloakId = :userId")
    List<String> findWordsByUserKeycloakId(@Param("userId") UUID userId);

    List<UserBannedWord> findByUserKeycloakId(UUID userId);
}