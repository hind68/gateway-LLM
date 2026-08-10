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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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

    private void respond(int status, String body) {
        server.createContext("/analyse", exchange -> write(exchange, status, body));
    }

    private void write(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
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