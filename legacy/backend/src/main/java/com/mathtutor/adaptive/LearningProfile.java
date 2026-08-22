package com.mathtutor.adaptive;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learning_profiles")
public class LearningProfile {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(nullable = false)
    private int accuracy;

    @Column(name = "mastered_count", nullable = false)
    private int masteredCount;

    @Column(name = "in_progress_count", nullable = false)
    private int inProgressCount;

    @Column(nullable = false)
    private int confidence;

    @Column(nullable = false)
    private String pace = "NEW";

    @Column(columnDefinition = "text")
    private String advice;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public int getAccuracy() { return accuracy; }
    public void setAccuracy(int accuracy) { this.accuracy = accuracy; }
    public int getMasteredCount() { return masteredCount; }
    public void setMasteredCount(int masteredCount) { this.masteredCount = masteredCount; }
    public int getInProgressCount() { return inProgressCount; }
    public void setInProgressCount(int inProgressCount) { this.inProgressCount = inProgressCount; }
    public int getConfidence() { return confidence; }
    public void setConfidence(int confidence) { this.confidence = confidence; }
    public String getPace() { return pace; }
    public void setPace(String pace) { this.pace = pace; }
    public String getAdvice() { return advice; }
    public void setAdvice(String advice) { this.advice = advice; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
