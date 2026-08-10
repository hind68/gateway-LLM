package com.example.backend.exceptions;

public class DlpAnalysisException extends RuntimeException {

    public DlpAnalysisException(String message) {
        super(message);
    }

    public DlpAnalysisException(String message, Throwable cause) {
        super(message, cause);
    }
}
