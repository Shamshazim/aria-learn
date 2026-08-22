package com.mathtutor.adaptive;

import java.util.Optional;
import java.util.UUID;

/**
 * Pure adaptive-learning rules. Kept free of persistence so the classification logic
 * (strength/weakness/recommendation/difficulty) is easy to unit test.
 */
public final class AdaptiveRules {

    private AdaptiveRules() {
    }

    /** Per-topic signal derived from the mastery record. */
    public record TopicSignal(
            UUID topicId,
            int total,
            Integer practiceAccuracy,
            Integer quizBest,
            Integer homework,
            boolean mastered,
            int requiredPct) {
    }

    public enum RecType { MORE_PRACTICE, REVIEW, INCREASE_DIFFICULTY, SCHEDULE_REVIEW }

    public static final int STRENGTH_THRESHOLD = 85;
    public static final int WEAKNESS_THRESHOLD = 60;

    public static boolean isStrength(TopicSignal s) {
        return s.mastered() || s.total() >= STRENGTH_THRESHOLD;
    }

    public static boolean isWeakness(TopicSignal s) {
        return !s.mastered() && s.total() > 0 && s.total() < WEAKNESS_THRESHOLD;
    }

    /** Short machine reason describing why a topic is weak. */
    public static String weaknessReason(TopicSignal s) {
        if (s.practiceAccuracy() != null && s.practiceAccuracy() < WEAKNESS_THRESHOLD) {
            return "LOW_PRACTICE";
        }
        if (s.quizBest() != null && s.quizBest() < s.requiredPct()) {
            return "LOW_QUIZ";
        }
        if (s.homework() != null && s.homework() < WEAKNESS_THRESHOLD) {
            return "LOW_HOMEWORK";
        }
        return "NEEDS_WORK";
    }

    /** The recommended next action for a topic, if any. */
    public static Optional<RecType> recommend(TopicSignal s) {
        if (s.mastered()) {
            return Optional.of(RecType.INCREASE_DIFFICULTY);
        }
        if (s.total() == 0) {
            return Optional.empty();
        }
        if (s.practiceAccuracy() != null && s.practiceAccuracy() < WEAKNESS_THRESHOLD) {
            return Optional.of(RecType.MORE_PRACTICE);
        }
        if (s.total() < s.requiredPct()) {
            return Optional.of(RecType.REVIEW);
        }
        return Optional.empty();
    }

    /** Difficulty for the next independent-practice set, based on recent practice accuracy. */
    public static String suggestDifficulty(Integer practiceAccuracy) {
        if (practiceAccuracy == null) {
            return "EASY";
        }
        if (practiceAccuracy < 50) {
            return "EASY";
        }
        if (practiceAccuracy < 75) {
            return "MEDIUM";
        }
        if (practiceAccuracy < 90) {
            return "HARD";
        }
        return "CHALLENGE";
    }

    /** A note that personalizes generated lessons/examples to the child's current level. */
    public static String learnerNote(String difficulty) {
        return switch (difficulty == null ? "EASY" : difficulty.toUpperCase()) {
            case "EASY" -> "This child is just beginning this topic. Keep explanations very simple, "
                    + "use small numbers, go one tiny step at a time, and be extra encouraging.";
            case "MEDIUM" -> "This child is making steady progress. Use clear, normal-paced examples.";
            case "HARD" -> "This child is doing well. You can include slightly larger numbers and "
                    + "a bit more challenge in the examples.";
            case "CHALLENGE" -> "This child has strong command of the basics. Include richer, more "
                    + "challenging examples and a little deeper reasoning.";
            default -> "Use clear, age-appropriate explanations.";
        };
    }

    public static String pace(int accuracy, int masteredCount) {
        if (masteredCount == 0 && accuracy == 0) {
            return "NEW";
        }
        if (accuracy >= 80) {
            return "FLYING";
        }
        if (accuracy >= 60) {
            return "STEADY";
        }
        return "BUILDING";
    }
}
