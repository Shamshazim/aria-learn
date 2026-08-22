package com.mathtutor.ai.prompt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.util.UUID;

public class PromptDtos {

    /** Summary of the currently-active version of a named prompt. */
    public record PromptSummary(
            String name,
            String category,
            int activeVersion,
            String modelTier,
            Instant updatedAt) {
    }

    /** Full content of a single prompt version. */
    public record PromptVersionDto(
            UUID id,
            String name,
            String category,
            int version,
            boolean active,
            String systemPrompt,
            String userPromptTemplate,
            String modelTier,
            double temperature,
            int maxTokens,
            boolean jsonMode,
            Instant createdAt) {
    }

    /** Request to publish a new version of a prompt. */
    public record CreateVersionRequest(
            @NotBlank String systemPrompt,
            @NotBlank String userPromptTemplate,
            String modelTier,
            Double temperature,
            Integer maxTokens,
            Boolean jsonMode) {
    }

    public record RollbackRequest(
            @Positive int version) {
    }

    public record TestRequest(
            java.util.Map<String, String> variables) {
    }
}
