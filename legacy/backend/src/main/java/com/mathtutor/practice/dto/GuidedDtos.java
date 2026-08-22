package com.mathtutor.practice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class GuidedDtos {

    public record StartGuidedRequest(@NotNull UUID topicId) {
    }

    public record GuidedQuestionDto(
            UUID questionId,
            String type,
            String prompt,
            List<String> choices) {
    }

    public record GuidedAttemptRequest(
            @NotNull UUID questionId,
            @NotBlank String response,
            @Min(1) int attempt) {
    }

    /** If correct, hint is null and the solution is revealed. If wrong, a hint is returned
     *  and the solution stays hidden so the child keeps trying. */
    public record GuidedFeedback(
            boolean correct,
            String hint,
            String solution,
            String correctAnswer) {
    }
}
