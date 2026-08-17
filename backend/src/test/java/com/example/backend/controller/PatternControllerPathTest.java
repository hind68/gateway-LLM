package com.example.backend.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PatternControllerPathTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void resolvesPatternsWhenBackendStartsFromRepositoryRoot() throws IOException {
        Path patternsFile = createPatternsFile(temporaryDirectory);

        Path resolved = PatternController.resolvePatternsPath(
                "../dlp/app/detectors/patterns.json",
                temporaryDirectory
        );

        assertThat(resolved).isEqualTo(patternsFile);
    }

    @Test
    void resolvesPatternsWhenBackendStartsFromBackendDirectory() throws IOException {
        Path patternsFile = createPatternsFile(temporaryDirectory);
        Path backendDirectory = Files.createDirectories(temporaryDirectory.resolve("backend"));

        Path resolved = PatternController.resolvePatternsPath(
                "../dlp/app/detectors/patterns.json",
                backendDirectory
        );

        assertThat(resolved).isEqualTo(patternsFile);
    }

    @Test
    void reportsConfigurationErrorInsteadOfReturningAnEmptyPatternList() {
        assertThatThrownBy(() -> PatternController.resolvePatternsPath(
                "missing/patterns.json",
                temporaryDirectory
        ))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    private Path createPatternsFile(Path repositoryRoot) throws IOException {
        Path file = repositoryRoot.resolve("dlp/app/detectors/patterns.json");
        Files.createDirectories(file.getParent());
        Files.writeString(file, "{\"patterns\":[]}");
        return file.toAbsolutePath().normalize();
    }
}
