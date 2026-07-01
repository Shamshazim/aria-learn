package com.mathtutor.ai.prompt;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A versioned, named prompt. Prompts are data, not code — they can be edited and
 * versioned without redeploying. Only one version per name is active at a time.
 */
@Entity
@Table(name = "prompt_templates")
public class PromptTemplate {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(name = "system_prompt", nullable = false, columnDefinition = "text")
    private String systemPrompt;

    @Column(name = "user_prompt_template", nullable = false, columnDefinition = "text")
    private String userPromptTemplate;

    @Column(name = "model_tier", nullable = false)
    private String modelTier = "TEACH";

    @Column(nullable = false)
    private double temperature = 0.7;

    @Column(name = "max_tokens", nullable = false)
    private int maxTokens = 2048;

    @Column(name = "json_mode", nullable = false)
    private boolean jsonMode = true;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }
    public String getUserPromptTemplate() { return userPromptTemplate; }
    public void setUserPromptTemplate(String userPromptTemplate) { this.userPromptTemplate = userPromptTemplate; }
    public String getModelTier() { return modelTier; }
    public void setModelTier(String modelTier) { this.modelTier = modelTier; }
    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }
    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
    public boolean isJsonMode() { return jsonMode; }
    public void setJsonMode(boolean jsonMode) { this.jsonMode = jsonMode; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
