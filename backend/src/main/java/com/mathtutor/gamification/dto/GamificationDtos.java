package com.mathtutor.gamification.dto;

import java.time.Instant;
import java.util.List;

public class GamificationDtos {

    public record StreakDto(int current, int longest) {
    }

    public record GoalDto(String period, String metric, int target, int progress) {
    }

    public record AchievementDto(
            String code,
            String name,
            String description,
            String icon,
            boolean earned,
            Instant earnedAt) {
    }

    public record GamificationSummary(
            int xpTotal,
            int level,
            int xpIntoLevel,
            int xpForNextLevel,
            StreakDto streak,
            List<GoalDto> goals,
            List<AchievementDto> achievements) {
    }
}
