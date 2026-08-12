package com.example.backend.dto;

public record ModelDto(
        String alias,
        String displayName,
        String description,
        String logoUrl,
        String providerCode,
        String providerName,
        String status
) {
    public ModelDto(String alias, String displayName) {
        this(alias, displayName, null, null, null, null, null);
    }
}
