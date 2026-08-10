package com.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record AddBannedWordRequest(
        UUID userId,   // null for a global word, required for a per-user one
        @NotBlank String word
) {}