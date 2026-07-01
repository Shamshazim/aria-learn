package com.mathtutor.mastery;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/** Configurable mastery rules. M4 uses the single GLOBAL row; GRADE/TOPIC overrides come later. */
@Entity
@Table(name = "mastery_config")
public class MasteryConfig {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String scope = "GLOBAL";

    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(name = "weight_knowledge", nullable = false)
    private int weightKnowledge;

    @Column(name = "weight_practice", nullable = false)
    private int weightPractice;

    @Column(name = "weight_quiz", nullable = false)
    private int weightQuiz;

    @Column(name = "weight_homework", nullable = false)
    private int weightHomework;

    @Column(name = "required_pct", nullable = false)
    private int requiredPct;

    @Column(name = "max_quiz_attempts", nullable = false)
    private int maxQuizAttempts;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public UUID getScopeId() { return scopeId; }
    public void setScopeId(UUID scopeId) { this.scopeId = scopeId; }
    public int getWeightKnowledge() { return weightKnowledge; }
    public void setWeightKnowledge(int v) { this.weightKnowledge = v; }
    public int getWeightPractice() { return weightPractice; }
    public void setWeightPractice(int v) { this.weightPractice = v; }
    public int getWeightQuiz() { return weightQuiz; }
    public void setWeightQuiz(int v) { this.weightQuiz = v; }
    public int getWeightHomework() { return weightHomework; }
    public void setWeightHomework(int v) { this.weightHomework = v; }
    public int getRequiredPct() { return requiredPct; }
    public void setRequiredPct(int v) { this.requiredPct = v; }
    public int getMaxQuizAttempts() { return maxQuizAttempts; }
    public void setMaxQuizAttempts(int v) { this.maxQuizAttempts = v; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
