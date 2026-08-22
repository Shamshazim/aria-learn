package com.mathtutor.adaptive.dto;

import java.util.List;
import java.util.UUID;

public class AdaptiveDtos {

    public record StrengthDto(UUID topicId, String topicName, int score) {
    }

    public record WeaknessDto(UUID topicId, String topicName, int score, String reason) {
    }

    public record MistakeDto(UUID topicId, String topicName, String misconception, int count) {
    }

    public record RecommendationDto(String type, UUID topicId, String topicName, String reason) {
    }

    public record ProfileDto(
            int accuracy,
            int masteredCount,
            int inProgressCount,
            int confidence,
            String pace,
            String advice,
            List<StrengthDto> strengths,
            List<WeaknessDto> weaknesses,
            List<MistakeDto> mistakes,
            List<RecommendationDto> recommendations) {
    }
}
