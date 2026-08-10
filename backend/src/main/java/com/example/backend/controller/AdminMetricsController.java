package com.example.backend.controller;

import com.example.backend.repository.AuditLogRepository;
import com.example.backend.repository.FilteredMessageRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/metrics")
@PreAuthorize("hasRole('ADMIN')")
public class AdminMetricsController {
    private final FilteredMessageRepository filteredMessages;
    private final AuditLogRepository audits;

    public AdminMetricsController(FilteredMessageRepository filteredMessages, AuditLogRepository audits) {
        this.filteredMessages = filteredMessages;
        this.audits = audits;
    }

    @GetMapping("/security")
    public Map<String, Object> securityMetrics() {
        Instant startOfDay = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        return Map.of(
                "totalIncidents", filteredMessages.count(),
                "blocked", filteredMessages.countByAction("BLOCKED"),
                "redacted", filteredMessages.countByAction("REDACTED"),
                "criticalIncidents", filteredMessages.countByHighestSeverity("CRITICAL"),
                "highSeverityIncidents", filteredMessages.countByHighestSeverity("HIGH"),
                "today", Map.of(
                        "analysedIncidents", filteredMessages.countByTimestampGreaterThanEqual(startOfDay),
                        "blocked", filteredMessages.countByTimestampGreaterThanEqualAndAction(startOfDay, "BLOCKED"),
                        "redacted", filteredMessages.countByTimestampGreaterThanEqualAndAction(startOfDay, "REDACTED")
                ),
                "auditEvents", audits.count()
        );
    }
}
