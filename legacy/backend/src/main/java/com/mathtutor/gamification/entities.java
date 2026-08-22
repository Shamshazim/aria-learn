package com.mathtutor.gamification;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// --- XP ledger -------------------------------------------------------------
@Entity
@Table(name = "xp_ledger")
class XpLedgerEntry {
    @Id @GeneratedValue private UUID id;
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(nullable = false) private int amount;
    @Column(nullable = false) private String reason;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

    UUID getId() { return id; }
    UUID getStudentId() { return studentId; }
    void setStudentId(UUID v) { this.studentId = v; }
    int getAmount() { return amount; }
    void setAmount(int v) { this.amount = v; }
    String getReason() { return reason; }
    void setReason(String v) { this.reason = v; }
    Instant getCreatedAt() { return createdAt; }
}

// --- Student level ---------------------------------------------------------
@Entity
@Table(name = "student_levels")
class StudentLevel {
    @Id @GeneratedValue private UUID id;
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(nullable = false) private int level = 1;
    @Column(name = "xp_total", nullable = false) private int xpTotal = 0;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

    UUID getStudentId() { return studentId; }
    void setStudentId(UUID v) { this.studentId = v; }
    int getLevel() { return level; }
    void setLevel(int v) { this.level = v; }
    int getXpTotal() { return xpTotal; }
    void setXpTotal(int v) { this.xpTotal = v; }
    void setUpdatedAt(Instant v) { this.updatedAt = v; }
}

// --- Achievement catalog ---------------------------------------------------
@Entity
@Table(name = "achievements")
class Achievement {
    @Id @GeneratedValue private UUID id;
    @Column(nullable = false) private String code;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String description;
    @Column(nullable = false) private String icon;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    @Column(name = "is_active", nullable = false) private boolean active = true;

    UUID getId() { return id; }
    String getCode() { return code; }
    String getName() { return name; }
    String getDescription() { return description; }
    String getIcon() { return icon; }
    int getSortOrder() { return sortOrder; }
}

// --- Earned achievement ----------------------------------------------------
@Entity
@Table(name = "student_achievements")
class StudentAchievement {
    @Id @GeneratedValue private UUID id;
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(name = "achievement_id", nullable = false) private UUID achievementId;
    @Column(name = "earned_at", nullable = false) private Instant earnedAt = Instant.now();

    UUID getStudentId() { return studentId; }
    void setStudentId(UUID v) { this.studentId = v; }
    UUID getAchievementId() { return achievementId; }
    void setAchievementId(UUID v) { this.achievementId = v; }
    Instant getEarnedAt() { return earnedAt; }
}

// --- Streak ----------------------------------------------------------------
@Entity
@Table(name = "streaks")
class Streak {
    @Id @GeneratedValue private UUID id;
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(name = "current_days", nullable = false) private int currentDays = 0;
    @Column(name = "longest_days", nullable = false) private int longestDays = 0;
    @Column(name = "last_active_date") private LocalDate lastActiveDate;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

    UUID getStudentId() { return studentId; }
    void setStudentId(UUID v) { this.studentId = v; }
    int getCurrentDays() { return currentDays; }
    void setCurrentDays(int v) { this.currentDays = v; }
    int getLongestDays() { return longestDays; }
    void setLongestDays(int v) { this.longestDays = v; }
    LocalDate getLastActiveDate() { return lastActiveDate; }
    void setLastActiveDate(LocalDate v) { this.lastActiveDate = v; }
    void setUpdatedAt(Instant v) { this.updatedAt = v; }
}

// --- Goal ------------------------------------------------------------------
@Entity
@Table(name = "goals")
class Goal {
    @Id @GeneratedValue private UUID id;
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(nullable = false) private String period;
    @Column(nullable = false) private String metric;
    @Column(nullable = false) private int target;
    @Column(nullable = false) private int progress = 0;
    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

    UUID getStudentId() { return studentId; }
    void setStudentId(UUID v) { this.studentId = v; }
    String getPeriod() { return period; }
    void setPeriod(String v) { this.period = v; }
    String getMetric() { return metric; }
    void setMetric(String v) { this.metric = v; }
    int getTarget() { return target; }
    void setTarget(int v) { this.target = v; }
    int getProgress() { return progress; }
    void setProgress(int v) { this.progress = v; }
    LocalDate getPeriodStart() { return periodStart; }
    void setPeriodStart(LocalDate v) { this.periodStart = v; }
    void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
