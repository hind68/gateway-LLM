package com.example.backend.integration.dlp;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DlpAnalysisRequest(
        String text,
        @JsonProperty("user_id") String userId,
        @JsonProperty("banned_words") List<String> bannedWords
) {
}