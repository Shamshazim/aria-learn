package com.mathtutor.homework.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class HomeworkDtos {

    public record HomeworkSummaryDto(
            UUID homeworkId,
            UUID topicId,
            String topicName,
            String status,
            Integer score,
            Instant dueAt,
            Instant createdAt) {
    }

    public record HomeworkQuestionDto(
            UUID questionId,
            String type,
            String prompt,
            List<String> choices) {
    }

    public record HomeworkDetailDto(
            UUID homeworkId,
            UUID topicId,
            String topicName,
            String status,
            Integer score,
            List<HomeworkQuestionDto> questions) {
    }

    public record SubmittedAnswer(
            @NotNull UUID questionId,
            String response) {
    }

    public record SubmitHomeworkRequest(
            @NotNull List<SubmittedAnswer> answers) {
    }

    /** Per-question evaluation result, shown once status is EVALUATED. */
    public record AnswerResultDto(
            UUID questionId,
            String prompt,
            String yourAnswer,
            boolean correct,
            int partialCredit,
            String feedback,
            String misconception,
            String correctAnswer,
            String solution) {
    }

    public record HomeworkResultDto(
            UUID homeworkId,
            String topicName,
            String status,
            Integer overallScore,
            String summary,
            String recommendations,
            List<AnswerResultDto> results) {
    }
}
