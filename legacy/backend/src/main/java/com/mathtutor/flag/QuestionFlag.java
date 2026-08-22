package com.mathtutor.flag;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/** A student's report that a question looks wrong or confusing, for parent review. */
@Entity
@Table(name = "question_flags")
public class QuestionFlag {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(columnDefinition = "text")
    private String reason;

    @Column(nullable = false)
    private boolean resolved = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }

    public UUID getQuestionId() { return questionId; }
    public void setQuestionId(UUID questionId) { this.questionId = questionId; }

    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public boolean isResolved() { return resolved; }
    public void setResolved(boolean resolved) { this.resolved = resolved; }

    public Instant getCreatedAt() { return createdAt; }
}
