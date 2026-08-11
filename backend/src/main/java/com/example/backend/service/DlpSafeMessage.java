package com.example.backend.service;

import java.util.List;

public record DlpSafeMessage(
        String safePrompt,
        String persistedContent,
        String highestSeverity,
        List<DlpAttachmentAnalysis> attachments
) {}
