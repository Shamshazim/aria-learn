package com.mathtutor.mastery;

/**
 * Pure mastery scoring. Weights apply only to components that have data, then are
 * renormalized over those present — so a topic with no homework yet is scored fairly
 * on the components the student has actually done.
 *
 * A topic is mastered only when a quiz has been taken AND the weighted total meets the
 * required threshold, so a child cannot "master" a topic just by opening the lesson.
 */
public final class MasteryCalculator {

    private MasteryCalculator() {
    }

    /** Component scores (0–100); null means the component has no data yet. */
    public record Components(Integer knowledge, Integer practice, Integer quiz, Integer homework) {
    }

    public record Outcome(int total, boolean mastered) {
    }

    public static Outcome compute(MasteryConfig cfg, Components c) {
        long weightedSum = 0;
        long weightTotal = 0;

        if (c.knowledge() != null) {
            weightedSum += (long) cfg.getWeightKnowledge() * c.knowledge();
            weightTotal += cfg.getWeightKnowledge();
        }
        if (c.practice() != null) {
            weightedSum += (long) cfg.getWeightPractice() * c.practice();
            weightTotal += cfg.getWeightPractice();
        }
        if (c.quiz() != null) {
            weightedSum += (long) cfg.getWeightQuiz() * c.quiz();
            weightTotal += cfg.getWeightQuiz();
        }
        if (c.homework() != null) {
            weightedSum += (long) cfg.getWeightHomework() * c.homework();
            weightTotal += cfg.getWeightHomework();
        }

        int total = weightTotal == 0 ? 0 : Math.round((float) weightedSum / weightTotal);
        boolean mastered = c.quiz() != null && total >= cfg.getRequiredPct();
        return new Outcome(total, mastered);
    }
}
