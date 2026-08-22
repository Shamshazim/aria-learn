package com.mathtutor.practice;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A stored question (generated or seeded). Persisting it lets us grade answers
 * server-side and reuse questions across activities.
 */
@Entity
@Table(name = "question_bank")
public class QuestionBank {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "topic_id", nullable = false)
    private UUID topicId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String difficulty;

    @Column(name = "prompt_text", nullable = false, columnDefinition = "text")
    private String promptText;

    /** JSON array of choices for MULTIPLE_CHOICE; null otherwise. */
    @Column(columnDefinition = "text")
    private String choices;

    @Column(name = "correct_answer", nullable = false, columnDefinition = "text")
    private String correctAnswer;

    @Column(columnDefinition = "text")
    private String solution;

    @Column(nullable = false)
    private String source = "GENERATED";

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTopicId() { return topicId; }
    public void setTopicId(UUID topicId) { this.topicId = topicId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public String getPromptText() { return promptText; }
    public void setPromptText(String promptText) { this.promptText = promptText; }
    public String getChoices() { return choices; }
    public void setChoices(String choices) { this.choices = choices; }
    public String getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
    public String getSolution() { return solution; }
    public void setSolution(String solution) { this.solution = solution; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
