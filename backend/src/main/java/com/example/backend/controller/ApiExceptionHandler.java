package com.example.backend.controller;

import com.example.backend.exceptions.DlpBlockedException;
import com.example.backend.exceptions.DlpUnavailableException;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(DlpBlockedException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_CONTENT)
    public ApiError handleDlpBlocked(DlpBlockedException exception) {
        return new ApiError(
                "DLP_BLOCKED",
                "Votre message contient une donnée sensible et ne peut pas être envoyé.",
                exception.getDetectedTypes(),
                exception.getHighestSeverity()
        );
    }

    @ExceptionHandler(DlpUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiError handleDlpUnavailable() {
        return new ApiError(
                "DLP_UNAVAILABLE",
                "Le controle de securite est indisponible. Le message n'a pas ete envoye au modele.",
                Set.of(),
                null
        );
    }

    public record ApiError(
            String code,
            String message,
            Set<String> detectedTypes,
            String highestSeverity
    ) {
    }
}
