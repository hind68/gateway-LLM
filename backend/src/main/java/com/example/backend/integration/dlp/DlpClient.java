package com.example.backend.integration.dlp;

import com.example.backend.exceptions.DlpAnalysisException;
import com.example.backend.exceptions.DlpUnavailableException;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Component
public class DlpClient {

    private final WebClient webClient;
    private final Duration readTimeout;

    public DlpClient(
            @Value("${dlp.base-url}") String baseUrl,
            @Value("${dlp.connect-timeout:2s}") Duration connectTimeout,
            @Value("${dlp.read-timeout:10s}") Duration readTimeout
    ) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, Math.toIntExact(connectTimeout.toMillis()))
                .responseTimeout(readTimeout);
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
        this.readTimeout = readTimeout;
    }

    public DlpAnalysisResponse analyse(String text, String userId, List<String> bannedWords) {
        try {
            return webClient.post()
                    .uri("/analyse")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(new DlpAnalysisRequest(text, userId, bannedWords))
                    .retrieve()
                    .onStatus(
                            status -> status.isError(),
                            response -> response.releaseBody()
                                    .thenReturn(new DlpUnavailableException("DLP service returned an error"))
                    )
                    .bodyToMono(DlpAnalysisResponse.class)
                    .block(readTimeout);
        } catch (DlpAnalysisException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new DlpUnavailableException("DLP service is unavailable", exception);
        }
    }
}