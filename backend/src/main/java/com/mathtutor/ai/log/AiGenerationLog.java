package com.mathtutor.ai.log;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_generation_logs")
public class AiGenerationLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prompt_name", nullable = false)
    private String promptName;

    @Column(name = "prompt_version", nullable = false)
    private int promptVersion;

    @Column(name = "model")
    private String model;

    @Column(name = "student_id")
    private UUID studentId;

    @Column(name = "tokens_in", nullable = false)
    private int tokensIn;

    @Column(name = "tokens_out", nullable = false)
    private int tokensOut;

    @Column(name = "latency_ms", nullable = false)
    private long latencyMs;

    @Column(name = "repair_attempts", nullable = false)
    private int repairAttempts;

    @Column(name = "success", nullable = false)
    private boolean success;

    @Column(name = "is_test", nullable = false)
    private boolean test;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getPromptName() { return promptName; }
    public void setPromptName(String promptName) { this.promptName = promptName; }
    public int getPromptVersion() { return promptVersion; }
    public void setPromptVersion(int promptVersion) { this.promptVersion = promptVersion; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public int getTokensIn() { return tokensIn; }
    public void setTokensIn(int tokensIn) { this.tokensIn = tokensIn; }
    public int getTokensOut() { return tokensOut; }
    public void setTokensOut(int tokensOut) { this.tokensOut = tokensOut; }
    public long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(long latencyMs) { this.latencyMs = latencyMs; }
    public int getRepairAttempts() { return repairAttempts; }
    public void setRepairAttempts(int repairAttempts) { this.repairAttempts = repairAttempts; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public boolean isTest() { return test; }
    public void setTest(boolean test) { this.test = test; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
