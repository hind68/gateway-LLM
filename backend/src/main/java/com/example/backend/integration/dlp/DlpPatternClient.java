package com.example.backend.integration.dlp;

import com.example.backend.entity.Pattern;
import com.example.backend.exceptions.DlpUnavailableException;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Component
public class DlpPatternClient {
    private final WebClient webClient;
    private final Duration timeout;
    private final String adminKey;

    public DlpPatternClient(
            @Value("${dlp.base-url}") String baseUrl,
            @Value("${dlp.connect-timeout:2s}") Duration connectTimeout,
            @Value("${dlp.read-timeout:10s}") Duration timeout,
            @Value("${dlp.admin-key:}") String adminKey
    ) {
        this.timeout = timeout;
        this.adminKey = adminKey;
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, Math.toIntExact(connectTimeout.toMillis()))
                .responseTimeout(timeout);
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    public void synchronize(List<Pattern> patterns) {
        if (adminKey == null || adminKey.isBlank()) return;
        try {
            webClient.put()
                    .uri("/admin/patterns")
                    .header("X-DLP-Admin-Key", adminKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("patterns", patterns))
                    .retrieve()
                    .toBodilessEntity()
                    .block(timeout);
        } catch (RuntimeException exception) {
            throw new DlpUnavailableException("Could not synchronize DLP patterns", exception);
        }
    }
}
