package com.mathtutor.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ExampleSetRepository extends JpaRepository<ExampleSet, UUID> {
    Optional<ExampleSet> findByStudentIdAndTopicIdAndActiveTrue(UUID studentId, UUID topicId);
    Optional<ExampleSet> findByTopicIdAndStudentIdIsNullAndActiveTrue(UUID topicId);
}
