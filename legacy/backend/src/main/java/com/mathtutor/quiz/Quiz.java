package com.mathtutor.quiz;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "quizzes")
public class Quiz {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "topic_id", nullable = false)
    private UUID topicId;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    @Column(name = "time_limit_sec", nullable = false)
    private int timeLimitSec;

    @Column(name = "passing_pct", nullable = false)
    private int passingPct;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTopicId() { return topicId; }
    public void setTopicId(UUID topicId) { this.topicId = topicId; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public int getQuestionCount() { return questionCount; }
    public void setQuestionCount(int questionCount) { this.questionCount = questionCount; }
    public int getTimeLimitSec() { return timeLimitSec; }
    public void setTimeLimitSec(int timeLimitSec) { this.timeLimitSec = timeLimitSec; }
    public int getPassingPct() { return passingPct; }
    public void setPassingPct(int passingPct) { this.passingPct = passingPct; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
