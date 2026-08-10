package com.example.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "role_llm_restrictions")
public class RoleLlmRestriction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String roleName;
    private String llmModelAlias;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public String getLlmModelAlias() { return llmModelAlias; }
    public void setLlmModelAlias(String llmModelAlias) { this.llmModelAlias = llmModelAlias; }
}