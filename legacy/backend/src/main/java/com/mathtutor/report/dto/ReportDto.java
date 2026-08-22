package com.mathtutor.report.dto;

import java.util.List;
import java.util.UUID;

public record ReportDto(
        UUID reportId,
        String studentName,
        String gradeName,
        String scope,
        String periodStart,
        String periodEnd,
        String generatedAt,
        int level,
        int xpTotal,
        int streak,
        int accuracy,
        int masteredCount,
        int inProgressCount,
        int totalTopics,
        int periodXp,
        int periodActivities,
        int activeDays,
        List<TopicLine> masteryByTopic,
        List<String> strengths,
        List<String> weaknesses,
        List<String> recommendations,
        String advice) {

    public record TopicLine(String topicName, String status, int total, Integer quiz, Integer homework) {
    }

    public ReportDto withReportId(UUID id) {
        return new ReportDto(id, studentName, gradeName, scope, periodStart, periodEnd, generatedAt,
                level, xpTotal, streak, accuracy, masteredCount, inProgressCount, totalTopics,
                periodXp, periodActivities, activeDays, masteryByTopic, strengths, weaknesses,
                recommendations, advice);
    }
}
