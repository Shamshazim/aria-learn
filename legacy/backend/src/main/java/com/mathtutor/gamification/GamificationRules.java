package com.mathtutor.gamification;

import java.time.LocalDate;

/**
 * Pure gamification math: the level curve and the streak transition.
 * Kept free of persistence so it is trivial to unit test.
 */
public final class GamificationRules {

    private GamificationRules() {
    }

    /** Total XP required to have reached a given level. L1=0, L2=100, L3=300, L4=600, L5=1000... */
    public static int totalXpForLevel(int level) {
        if (level <= 1) {
            return 0;
        }
        return 50 * level * (level - 1);
    }

    public static int levelFor(int xpTotal) {
        int level = 1;
        while (xpTotal >= totalXpForLevel(level + 1)) {
            level++;
        }
        return level;
    }

    /** XP earned within the current level. */
    public static int xpIntoLevel(int xpTotal) {
        return xpTotal - totalXpForLevel(levelFor(xpTotal));
    }

    /** XP span of the current level (how much is needed to advance). */
    public static int xpForNextLevel(int xpTotal) {
        int level = levelFor(xpTotal);
        return totalXpForLevel(level + 1) - totalXpForLevel(level);
    }

    /**
     * Next streak value given the last active date and today.
     * Same day -> unchanged; yesterday -> +1; any gap -> reset to 1.
     */
    public static int nextStreak(LocalDate lastActive, LocalDate today, int current) {
        if (lastActive == null) {
            return 1;
        }
        if (lastActive.equals(today)) {
            return Math.max(current, 1);
        }
        if (lastActive.equals(today.minusDays(1))) {
            return current + 1;
        }
        return 1;
    }
}
