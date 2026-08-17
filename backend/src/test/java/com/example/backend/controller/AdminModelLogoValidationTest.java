package com.example.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class AdminModelLogoValidationTest {

    @Test
    void acceptsRemoteAndEmbeddedRasterLogos() {
        assertThat(AdminModelController.safeLogoUrl("https://cdn.example.test/model.png"))
                .isEqualTo("https://cdn.example.test/model.png");
        assertThat(AdminModelController.safeLogoUrl("data:image/png;base64,iVBORw0KGgo="))
                .isEqualTo("data:image/png;base64,iVBORw0KGgo=");
    }

    @Test
    void convertsAWikimediaDescriptionPageToItsDirectFileRedirect() {
        assertThat(AdminModelController.safeLogoUrl("https://commons.wikimedia.org/wiki/File:Claude-ai-icon.svg"))
                .isEqualTo("https://commons.wikimedia.org/wiki/Special:Redirect/file/Claude-ai-icon.svg");
    }

    @Test
    void rejectsUnsafeOrUnsupportedLogoSources() {
        assertBadRequest("javascript:alert(1)");
        assertBadRequest("data:image/svg+xml;base64,PHN2Zz4=");
        assertBadRequest("data:text/html;base64,PGgxPkJhZDwvaDE+");
    }

    private void assertBadRequest(String value) {
        assertThatThrownBy(() -> AdminModelController.safeLogoUrl(value))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
