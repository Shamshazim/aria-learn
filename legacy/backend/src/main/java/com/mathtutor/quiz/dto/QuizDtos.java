package com.mathtutor.quiz.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class QuizDtos {

    public record StartQuizRequest(@NotNull UUID topicId) {
    }

    public record QuizQuestionDto(
            UUID questionId,
            String type,
            String prompt,
            List<String> choices) {
    }

    public record QuizDto(
            UUID quizId,
            UUID attemptId,
            int timeLimitSec,
            int passingPct,
            List<QuizQuestionDto> questions) {
    }

    public record SubmittedAnswer(
            @NotNull UUID questionId,
            String response) {
    }

    public record SubmitQuizRequest(
            @NotNull UUID attemptId,
            @NotNull List<SubmittedAnswer> answers) {
    }

    public record QuestionResult(
            UUID questionId,
            String prompt,
            String yourAnswer,
            boolean correct,
            String correctAnswer,
            String solution,
            String feedback) {
    }

    public record QuizResult(
            int scorePct,
            boolean passed,
            int correct,
            int total,
            List<QuestionResult> results) {
    }
}
