package com.example.backend.service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class DlpService {

    private final WebClient webClient;

    public DlpService(@Value("${dlp.base-url}") String baseUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    /**
     * Calls the Python DLP gateway's POST /analyse. Fails OPEN: if the
     * DLP service is down or times out, the message is treated as clean
     * rather than blocking the whole chat feature on a DLP outage. Flip
     * the catch block below to rethrow instead, if you'd rather fail
     * closed (block everything when DLP is unreachable) - that's a real
     * decision, not something to leave implicit.
     */
    public DlpResult analyse(String text, String userId) {
        try {
            Map<String, Object> body = userId != null
                    ? Map.of("text", text, "user_id", userId)
                    : Map.of("text", text);

            Map<?, ?> response = webClient.post()
                    .uri("/analyse")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(10));

            return parse(response, text);
        } catch (Exception e) {
            return new DlpResult(false, text, List.of(), false);
        }
    }

    private DlpResult parse(Map<?, ?> response, String originalText) {
        if (response == null) {
            return new DlpResult(false, originalText, List.of(), false);
        }

        boolean flagged = Boolean.TRUE.equals(response.get("flagged"));
        String maskedText = response.get("masked_text") instanceof String s ? s : originalText;
        List<?> matches = response.get("matches") instanceof List<?> l ? l : List.of();

        boolean hasHighSeverity = matches.stream()
                .filter(m -> m instanceof Map<?, ?>)
                .map(m -> (Map<?, ?>) m)
                .anyMatch(m -> "high".equals(m.get("severity")));

        return new DlpResult(flagged, maskedText, matches, hasHighSeverity);
    }

    public record DlpResult(
            boolean flagged,
            String maskedText,
            List<?> matches,
            boolean hasHighSeverity
    ) {
    }
}