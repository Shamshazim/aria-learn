package com.mathtutor.progress.dto;

import java.util.UUID;

public class ProgressDtos {

    public record TopicProgressDto(
            UUID topicId,
            String topicName,
            String unitName,
            String lessonName,
            String status,
            int masteryScore,
            boolean mastered) {
    }
}
