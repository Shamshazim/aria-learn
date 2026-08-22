package com.mathtutor.adaptive;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mistake_log")
public class MistakeLogEntry {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(name = "topic_id", nullable = false)
    private UUID topicId;

    @Column(nullable = false)
    private String misconception;

    @Column(nullable = false)
    private int count = 1;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public UUID getTopicId() { return topicId; }
    public void setTopicId(UUID topicId) { this.topicId = topicId; }
    public String getMisconception() { return misconception; }
    public void setMisconception(String misconception) { this.misconception = misconception; }
    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
