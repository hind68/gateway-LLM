package com.example.backend.repository;

import com.example.backend.entity.FilteredMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.Instant;

@Repository
public interface FilteredMessageRepository extends JpaRepository<FilteredMessage, Long>, JpaSpecificationExecutor<FilteredMessage> {
    List<FilteredMessage> findAllByOrderByTimestampDesc();
    long countByAction(String action);
    long countByHighestSeverity(String highestSeverity);
    long countByTimestampGreaterThanEqual(Instant timestamp);
    long countByTimestampGreaterThanEqualAndAction(Instant timestamp, String action);
}
