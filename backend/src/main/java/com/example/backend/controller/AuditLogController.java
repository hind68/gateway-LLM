package com.example.backend.controller;

import com.example.backend.entity.AuditLog;
import com.example.backend.repository.AuditLogRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Objects;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/admin/audit")
@PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    public AuditLogController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    public Page<AuditLog> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityName,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to
    ) {
        Specification<AuditLog> specification = Specification.allOf(Stream.of(
                contains("action", action),
                contains("entityName", entityName),
                contains("performedBy", performedBy),
                search(search),
                from == null ? null : (root, query, builder) -> builder.greaterThanOrEqualTo(root.get("timestamp"), from),
                to == null ? null : (root, query, builder) -> builder.lessThanOrEqualTo(root.get("timestamp"), to)
        ).filter(Objects::nonNull).toList());
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100), Sort.by(Sort.Direction.DESC, "timestamp"));
        return auditLogRepository.findAll(specification, pageable);
    }

    private Specification<AuditLog> contains(String field, String value) {
        if (value == null || value.isBlank()) return null;
        return (root, query, builder) -> builder.like(builder.lower(root.get(field).as(String.class)), "%" + value.trim().toLowerCase() + "%");
    }

    private Specification<AuditLog> search(String value) {
        if (value == null || value.isBlank()) return null;
        String pattern = "%" + value.trim().toLowerCase() + "%";
        return (root, query, builder) -> builder.or(
                builder.like(builder.lower(root.get("action")), pattern),
                builder.like(builder.lower(root.get("entityName")), pattern),
                builder.like(builder.lower(root.get("entityId")), pattern),
                builder.like(builder.lower(root.get("performedBy").as(String.class)), pattern)
        );
    }
}
