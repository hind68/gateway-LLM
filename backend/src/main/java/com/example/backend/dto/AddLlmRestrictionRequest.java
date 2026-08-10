package com.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AddLlmRestrictionRequest(
        @NotNull UUID userId,
        @NotBlank String llmModelAlias
) {}