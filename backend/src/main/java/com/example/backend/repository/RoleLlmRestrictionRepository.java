package com.example.backend.repository;

import com.example.backend.entity.RoleLlmRestriction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RoleLlmRestrictionRepository extends JpaRepository<RoleLlmRestriction, Long> {
    List<RoleLlmRestriction> findByRoleName(String roleName);
}