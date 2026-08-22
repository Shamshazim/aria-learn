package com.mathtutor.mastery.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.UUID;

public class MasteryDtos {

    public record MasteryConfigDto(
            @Min(0) @Max(100) int weightKnowledge,
            @Min(0) @Max(100) int weightPractice,
            @Min(0) @Max(100) int weightQuiz,
            @Min(0) @Max(100) int weightHomework,
            @Min(1) @Max(100) int requiredPct,
            @Min(1) int maxQuizAttempts) {
    }

    /** Per-topic mastery breakdown for a student. */
    public record MasteryBreakdownDto(
            UUID topicId,
            Integer knowledgeScore,
            Integer practiceScore,
            Integer quizBestScore,
            Integer homeworkScore,
            int totalScore,
            int requiredPct,
            boolean mastered) {
    }
}
