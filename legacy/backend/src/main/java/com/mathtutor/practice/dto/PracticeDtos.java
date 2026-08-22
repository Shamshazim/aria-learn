package com.mathtutor.practice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class PracticeDtos {

    public record GeneratePracticeRequest(
            @NotNull UUID topicId,
            String difficulty,
            @Min(1) @Max(10) Integer count) {
    }

    /** A question as shown to the student — never includes the answer or solution. */
    public record PracticeQuestionDto(
            UUID questionId,
            String type,
            String difficulty,
            String prompt,
            List<String> choices) {
    }

    public record PracticeSetDto(
            UUID topicId,
            String difficulty,
            List<PracticeQuestionDto> questions) {
    }

    public record AnswerRequest(
            @NotNull UUID questionId,
            @NotBlank String response) {
    }

    public record AnswerResult(
            boolean correct,
            String correctAnswer,
            String solution,
            String feedback) {
    }
}
