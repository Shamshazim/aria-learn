package com.mathtutor.homework;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_evaluations")
public class AiEvaluation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "homework_id", nullable = false)
    private UUID homeworkId;

    @Column(name = "overall_score", nullable = false)
    private int overallScore;

    @Column(columnDefinition = "text")
    private String summary;

    @Column(columnDefinition = "text")
    private String recommendations;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getHomeworkId() { return homeworkId; }
    public void setHomeworkId(UUID homeworkId) { this.homeworkId = homeworkId; }
    public int getOverallScore() { return overallScore; }
    public void setOverallScore(int overallScore) { this.overallScore = overallScore; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getRecommendations() { return recommendations; }
    public void setRecommendations(String recommendations) { this.recommendations = recommendations; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
