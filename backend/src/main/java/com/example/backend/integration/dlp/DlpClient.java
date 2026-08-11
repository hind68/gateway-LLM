package com.example.backend.integration.dlp;

import com.example.backend.exceptions.DlpAnalysisException;
import com.example.backend.exceptions.DlpUnavailableException;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import java.util.List;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Component
public class DlpClient {

    private static final MediaType APPLICATION_JSON_UTF8 = new MediaType("application", "json", StandardCharsets.UTF_8);

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
                    .accept(APPLICATION_JSON_UTF8)
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

    public DlpMultiSourceAnalysisResponse analyseMessage(String text, List<MultipartFile> files, String userId, List<String> bannedWords) {
        try {
            MultipartBodyBuilder body = new MultipartBodyBuilder();
            if (text != null && !text.isBlank()) body.part("text", text);
            if (userId != null && !userId.isBlank()) body.part("user_id", userId);
            if (bannedWords != null && !bannedWords.isEmpty()) body.part("banned_words", String.join("\n", bannedWords));
            if (files != null) {
                for (MultipartFile file : files) {
                    if (file == null || file.isEmpty()) continue;
                    body.part("files", uploadResource(file))
                            .filename(file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename())
                            .contentType(safeMediaType(file.getContentType()));
                }
            }
            return webClient.post().uri("/analyse-message")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(APPLICATION_JSON_UTF8)
                    .bodyValue(body.build())
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> response.releaseBody().thenReturn(new DlpUnavailableException("DLP service returned an error")))
                    .bodyToMono(DlpMultiSourceAnalysisResponse.class)
                    .block(readTimeout);
        } catch (DlpAnalysisException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new DlpUnavailableException("DLP service is unavailable", exception);
        }
    }

    private ByteArrayResource uploadResource(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            String filename = file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename();
            return new ByteArrayResource(bytes) { @Override public String getFilename() { return filename; } };
        } catch (IOException exception) {
            throw new DlpUnavailableException("Could not read attachment for DLP analysis", exception);
        }
    }

    private MediaType safeMediaType(String value) {
        if (value == null || value.isBlank()) return MediaType.APPLICATION_OCTET_STREAM;
        try { return MediaType.parseMediaType(value); } catch (RuntimeException exception) { return MediaType.APPLICATION_OCTET_STREAM; }
    }
}
