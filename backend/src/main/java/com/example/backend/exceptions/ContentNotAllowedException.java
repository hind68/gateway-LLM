package com.example.backend.exceptions;

public class ContentNotAllowedException extends RuntimeException {
    public ContentNotAllowedException(String message) {
        super(message);
    }
}