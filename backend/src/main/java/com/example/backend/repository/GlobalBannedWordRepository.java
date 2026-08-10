package com.example.backend.repository;

import com.example.backend.entity.GlobalBannedWord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface GlobalBannedWordRepository extends JpaRepository<GlobalBannedWord, Long> {
    // Projection to a plain word list, not full entities - this runs on
    // every chat message, no reason to hydrate id/createdAt/createdBy
    // for a check that only needs the strings.
    @Query("SELECT g.word FROM GlobalBannedWord g")
    List<String> findAllWords();
}