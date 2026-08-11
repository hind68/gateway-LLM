package com.example.backend.integration.dlp;

import com.example.backend.exceptions.DlpUnavailableException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DlpClientTest {

    private HttpServer server;
    private ExecutorService executor;
    private DlpClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        executor = Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.start();
        client = new DlpClient(
                "http://localhost:" + server.getAddress().getPort(),
                Duration.ofMillis(200),
                Duration.ofMillis(200)
        );
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        executor.shutdownNow();
    }

    @Test
    void http500FailsClosed() {
        respond(500, "{\"error\":\"boom\"}");

        assertThatThrownBy(() -> client.analyse("Mon email est client@example.com", "demo-user", List.of()))
                .isInstanceOf(DlpUnavailableException.class);
    }

    @Test
    void invalidJsonFailsClosed() {
        respond(200, "{not-json");

        assertThatThrownBy(() -> client.analyse("Mon email est client@example.com", "demo-user", List.of()))
                .isInstanceOf(DlpUnavailableException.class);
    }

    @Test
    void unknownDecisionFailsClosed() {
        respond(200, """
                {
                  "status": "SUCCESS",
                  "decision": "UNKNOWN",
                  "flagged": false,
                  "highest_severity": null,
                  "masked_text": "Bonjour",
                  "matches": [],
                  "errors": []
                }
                """);

        assertThatThrownBy(() -> client.analyse("Bonjour", "demo-user", List.of()))
                .isInstanceOf(DlpUnavailableException.class);
    }

    @Test
    void timeoutFailsClosed() {
        server.createContext("/analyse", exchange -> {
            sleepPastTimeout();
            write(exchange, 200, """
                    {
                      "status": "SUCCESS",
                      "decision": "ALLOW",
                      "flagged": false,
                      "highest_severity": null,
                      "masked_text": "Bonjour",
                      "matches": [],
                      "errors": []
                    }
                    """);
        });

        assertThatThrownBy(() -> client.analyse("Bonjour", "demo-user", List.of()))
                .isInstanceOf(DlpUnavailableException.class);
    }

    @Test
    void sendsJsonAsUtf8WithExplicitContentType() {
        DlpClient utf8Client = new DlpClient(
                "http://localhost:" + server.getAddress().getPort(),
                Duration.ofSeconds(1),
                Duration.ofSeconds(1)
        );
        AtomicReference<String> contentType = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        server.createContext("/analyse", exchange -> {
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            write(exchange, 200, """
                    {
                      "status": "SUCCESS",
                      "decision": "MASK",
                      "flagged": true,
                      "highest_severity": "medium",
                      "masked_text": "Ma clé API [OPENAI_API_KEY_1]",
                      "matches": [],
                      "errors": []
                    }
                    """);
        });

        utf8Client.analyse("Ma clé API. Mon numéro de téléphone. La référence est AB123456", "demo-user");

        assertThat(contentType.get()).contains("application/json").contains("charset=UTF-8");
        assertThat(body.get()).contains("Ma clé API");
        assertThat(body.get()).contains("Mon numéro de téléphone");
        assertThat(body.get()).contains("La référence est AB123456");
        assertThat(body.get()).doesNotContain("clÃ©", "numÃ©ro", "rÃ©fÃ©rence");
    }

    private void respond(int status, String body) {
        server.createContext("/analyse", exchange -> write(exchange, status, body));
    }

    private void write(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private void sleepPastTimeout() {
        try {
            Thread.sleep(500);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}