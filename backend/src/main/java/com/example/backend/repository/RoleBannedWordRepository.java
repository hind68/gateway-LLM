package com.example.backend.repository;

import com.example.backend.entity.RoleBannedWord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RoleBannedWordRepository extends JpaRepository<RoleBannedWord, Long> {
    List<RoleBannedWord> findByRoleName(String roleName);
}