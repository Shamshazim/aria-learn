package com.mathtutor.parent.dto;

import java.util.List;
import java.util.UUID;

public class ParentDashboardDtos {

    public record ChildSummaryDto(
            UUID studentId,
            String displayName,
            int level,
            int xpTotal,
            int streak,
            int masteredCount,
            int inProgressCount,
            int accuracy,
            int weeklyActivities,
            int weeklyTarget) {
    }

    public record TopicMasteryChartDto(
            UUID topicId,
            String topicName,
            String status,
            int total,
            Integer knowledge,
            Integer practice,
            Integer quiz,
            Integer homework) {
    }

    public record ActivityDayDto(String date, int xp, int count) {
    }

    public record ChartsDto(
            List<TopicMasteryChartDto> masteryByTopic,
            List<ActivityDayDto> activityByDay) {
    }
}
