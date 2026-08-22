package com.mathtutor.mastery;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface MasteryConfigRepository extends JpaRepository<MasteryConfig, UUID> {
    Optional<MasteryConfig> findByScope(String scope);
}

interface MasteryRecordRepository extends JpaRepository<MasteryRecord, UUID> {
    Optional<MasteryRecord> findByStudentIdAndTopicId(UUID studentId, UUID topicId);
    List<MasteryRecord> findByStudentId(UUID studentId);
    long countByTopicId(UUID topicId);
}
