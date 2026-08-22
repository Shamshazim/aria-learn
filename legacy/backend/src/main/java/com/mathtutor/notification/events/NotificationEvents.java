package com.mathtutor.notification.events;

import java.util.UUID;

/** Domain events that lead to notifications. Published inside a transaction and
 *  handled after commit, so a notification only fires for an action that succeeded. */
public class NotificationEvents {

    public record AchievementEarnedEvent(UUID studentId, String name, String icon) {
    }

    public record TopicMasteredEvent(UUID studentId, UUID topicId) {
    }

    public record HomeworkAssignedEvent(UUID studentId, UUID topicId) {
    }

    public record HomeworkGradedEvent(UUID studentId, UUID topicId, int score) {
    }
}
