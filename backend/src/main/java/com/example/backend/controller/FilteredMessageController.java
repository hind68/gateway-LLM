package com.example.backend.controller;

import com.example.backend.entity.FilteredMessage;
import com.example.backend.repository.FilteredMessageRepository;
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
@RequestMapping("/api/admin/filtered-messages")
@PreAuthorize("hasRole('ADMIN')")
public class FilteredMessageController {

    private final FilteredMessageRepository filteredMessageRepository;

    public FilteredMessageController(FilteredMessageRepository filteredMessageRepository) {
        this.filteredMessageRepository = filteredMessageRepository;
    }

    @GetMapping
    public Page<FilteredMessage> getFilteredMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to
    ) {
        Specification<FilteredMessage> specification = Specification.allOf(Stream.of(
                contains("action", action),
                contains("userKeycloakId", userId),
                search(search),
                from == null ? null : (root, query, builder) -> builder.greaterThanOrEqualTo(root.get("timestamp"), from),
                to == null ? null : (root, query, builder) -> builder.lessThanOrEqualTo(root.get("timestamp"), to)
        ).filter(Objects::nonNull).toList());
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100), Sort.by(Sort.Direction.DESC, "timestamp"));
        return filteredMessageRepository.findAll(specification, pageable);
    }

    private Specification<FilteredMessage> contains(String field, String value) {
        if (value == null || value.isBlank()) return null;
        return (root, query, builder) -> builder.like(builder.lower(root.get(field).as(String.class)), "%" + value.trim().toLowerCase() + "%");
    }

    private Specification<FilteredMessage> search(String value) {
        if (value == null || value.isBlank()) return null;
        String pattern = "%" + value.trim().toLowerCase() + "%";
        return (root, query, builder) -> builder.or(
                builder.like(builder.lower(root.get("action")), pattern),
                builder.like(builder.lower(root.get("reason")), pattern),
                builder.like(builder.lower(root.get("userKeycloakId").as(String.class)), pattern),
                builder.like(builder.lower(root.get("originalContent")), pattern),
                builder.like(builder.lower(root.get("redactedContent")), pattern)
        );
    }
}
