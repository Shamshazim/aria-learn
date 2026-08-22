package com.mathtutor.content;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/** Cached AI-generated knowledge article for a topic. Generated once, reused for all students. */
@Entity
@Table(name = "knowledge_articles")
public class KnowledgeArticle {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "topic_id", nullable = false)
    private UUID topicId;

    /** Owning student; null means a generic (parent-preview) version. */
    @Column(name = "student_id")
    private UUID studentId;

    @Column(nullable = false)
    private int version = 1;

    /** Serialized KnowledgeContent JSON. */
    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "generated_by_prompt_version")
    private Integer generatedByPromptVersion;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTopicId() { return topicId; }
    public void setTopicId(UUID topicId) { this.topicId = topicId; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Integer getGeneratedByPromptVersion() { return generatedByPromptVersion; }
    public void setGeneratedByPromptVersion(Integer v) { this.generatedByPromptVersion = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
