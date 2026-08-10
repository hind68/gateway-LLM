package com.example.backend.controller;


import com.example.backend.entity.RoleBannedWord;
import com.example.backend.entity.RoleLlmRestriction;
import com.example.backend.repository.RoleBannedWordRepository;
import com.example.backend.repository.RoleLlmRestrictionRepository;
import com.example.backend.repository.AuditLogRepository;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/permissions")
public class RolePermissionController {

    private final RoleBannedWordRepository roleBannedWordRepository;
    private final RoleLlmRestrictionRepository roleLlmRestrictionRepository;
    private final AuditLogRepository auditLogRepository;

    public RolePermissionController(RoleBannedWordRepository roleBannedWordRepository,
                                    RoleLlmRestrictionRepository roleLlmRestrictionRepository,
                                    AuditLogRepository auditLogRepository) {
        this.roleBannedWordRepository = roleBannedWordRepository;
        this.roleLlmRestrictionRepository = roleLlmRestrictionRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping("/banned-words/role/{roleName}")
    @PreAuthorize("hasRole('ADMIN')")
    public List<RoleBannedWord> getRoleBannedWords(@PathVariable String roleName) {
        return roleBannedWordRepository.findByRoleName(roleName.toUpperCase());
    }

    @PostMapping("/banned-words/role")
    @PreAuthorize("hasRole('ADMIN')")
    public RoleBannedWord addRoleBannedWord(@RequestBody RoleBannedWord roleBannedWord, JwtAuthenticationToken auth) {
        roleBannedWord.setRoleName(roleBannedWord.getRoleName().toUpperCase());
        RoleBannedWord saved = roleBannedWordRepository.save(roleBannedWord);
        auditLogRepository.save(new com.example.backend.entity.AuditLog("CREATE", "ROLE_BANNED_WORD", String.valueOf(saved.getId()), performer(auth)));
        return saved;
    }

    @DeleteMapping("/banned-words/role/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteRoleBannedWord(@PathVariable Long id, JwtAuthenticationToken auth) {
        roleBannedWordRepository.deleteById(id);
        auditLogRepository.save(new com.example.backend.entity.AuditLog("DELETE", "ROLE_BANNED_WORD", String.valueOf(id), performer(auth)));
    }

    @GetMapping("/llm-restrictions/role/{roleName}")
    @PreAuthorize("hasRole('ADMIN')")
    public List<RoleLlmRestriction> getRoleRestrictions(@PathVariable String roleName) {
        return roleLlmRestrictionRepository.findByRoleName(roleName.toUpperCase());
    }

    @PostMapping("/llm-restrictions/role")
    @PreAuthorize("hasRole('ADMIN')")
    public RoleLlmRestriction addRoleRestriction(@RequestBody RoleLlmRestriction restriction, JwtAuthenticationToken auth) {
        restriction.setRoleName(restriction.getRoleName().toUpperCase());
        RoleLlmRestriction saved = roleLlmRestrictionRepository.save(restriction);
        auditLogRepository.save(new com.example.backend.entity.AuditLog("CREATE", "ROLE_LLM_RESTRICTION", String.valueOf(saved.getId()), performer(auth)));
        return saved;
    }

    @DeleteMapping("/llm-restrictions/role/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteRoleRestriction(@PathVariable Long id, JwtAuthenticationToken auth) {
        roleLlmRestrictionRepository.deleteById(id);
        auditLogRepository.save(new com.example.backend.entity.AuditLog("DELETE", "ROLE_LLM_RESTRICTION", String.valueOf(id), performer(auth)));
    }

    private java.util.UUID performer(JwtAuthenticationToken auth) {
        return java.util.UUID.fromString(auth.getToken().getSubject());
    }
}
