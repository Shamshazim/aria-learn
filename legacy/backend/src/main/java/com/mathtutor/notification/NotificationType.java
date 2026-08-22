package com.mathtutor.notification;

import java.util.List;

/** Notification types and their user-facing labels (for preference toggles). */
public final class NotificationType {

    private NotificationType() {
    }

    // Student-facing
    public static final String ACHIEVEMENT = "ACHIEVEMENT";
    public static final String MASTERY = "MASTERY";
    public static final String UNLOCK = "UNLOCK";
    public static final String HOMEWORK_ASSIGNED = "HOMEWORK_ASSIGNED";
    public static final String HOMEWORK_GRADED = "HOMEWORK_GRADED";
    public static final String REMINDER = "REMINDER";

    // Parent-facing
    public static final String CHILD_MASTERY = "CHILD_MASTERY";
    public static final String CHILD_HOMEWORK = "CHILD_HOMEWORK";

    public record TypeInfo(String type, String label) {
    }

    public static List<TypeInfo> forStudent() {
        return List.of(
                new TypeInfo(ACHIEVEMENT, "Badges earned"),
                new TypeInfo(MASTERY, "Topic mastered"),
                new TypeInfo(UNLOCK, "New topic unlocked"),
                new TypeInfo(HOMEWORK_ASSIGNED, "New homework"),
                new TypeInfo(HOMEWORK_GRADED, "Homework graded"),
                new TypeInfo(REMINDER, "Daily reminders"));
    }

    public static List<TypeInfo> forParent() {
        return List.of(
                new TypeInfo(CHILD_MASTERY, "A child masters a topic"),
                new TypeInfo(CHILD_HOMEWORK, "A child's homework is graded"));
    }
}
