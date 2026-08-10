package com.example.backend.exceptions;

public class DlpInvalidResponseException extends DlpUnavailableException {

    public DlpInvalidResponseException(String message) {
        super(message);
    }
}
