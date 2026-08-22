package com.mathtutor.gamification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface XpLedgerRepository extends JpaRepository<XpLedgerEntry, UUID> {
    List<XpLedgerEntry> findByStudentIdAndCreatedAtAfter(UUID studentId, Instant after);
}

interface StudentLevelRepository extends JpaRepository<StudentLevel, UUID> {
    Optional<StudentLevel> findByStudentId(UUID studentId);
}

interface AchievementRepository extends JpaRepository<Achievement, UUID> {
    List<Achievement> findByActiveTrueOrderBySortOrder();
    Optional<Achievement> findByCode(String code);
}

interface StudentAchievementRepository extends JpaRepository<StudentAchievement, UUID> {
    List<StudentAchievement> findByStudentId(UUID studentId);
    boolean existsByStudentIdAndAchievementId(UUID studentId, UUID achievementId);
}

interface StreakRepository extends JpaRepository<Streak, UUID> {
    Optional<Streak> findByStudentId(UUID studentId);
}

interface GoalRepository extends JpaRepository<Goal, UUID> {
    Optional<Goal> findByStudentIdAndPeriod(UUID studentId, String period);
}
