package com.mathtutor.ai.log;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AiGenerationLogRepository extends JpaRepository<AiGenerationLog, UUID> {
    List<AiGenerationLog> findByTestFalseAndCreatedAtAfter(Instant after);
}
