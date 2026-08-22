package com.mathtutor.adaptive;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface LearningProfileRepository extends JpaRepository<LearningProfile, UUID> {
    Optional<LearningProfile> findByStudentId(UUID studentId);
}

interface StrengthRepository extends JpaRepository<Strength, UUID> {
    List<Strength> findByStudentId(UUID studentId);
    @Transactional
    void deleteByStudentId(UUID studentId);
}

interface WeaknessRepository extends JpaRepository<Weakness, UUID> {
    List<Weakness> findByStudentId(UUID studentId);
    @Transactional
    void deleteByStudentId(UUID studentId);
}

interface MistakeLogRepository extends JpaRepository<MistakeLogEntry, UUID> {
    List<MistakeLogEntry> findByStudentIdOrderByCountDesc(UUID studentId);
    @Transactional
    void deleteByStudentId(UUID studentId);
}

interface StudyRecommendationRepository extends JpaRepository<StudyRecommendation, UUID> {
    List<StudyRecommendation> findByStudentIdOrderByCreatedAtDesc(UUID studentId);
    @Transactional
    void deleteByStudentId(UUID studentId);
}
