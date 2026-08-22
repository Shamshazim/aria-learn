package com.mathtutor.gamification;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class GamificationRulesTest {

    @Test
    void levelThresholdsFollowTheCurve() {
        assertThat(GamificationRules.totalXpForLevel(1)).isZero();
        assertThat(GamificationRules.totalXpForLevel(2)).isEqualTo(100);
        assertThat(GamificationRules.totalXpForLevel(3)).isEqualTo(300);
        assertThat(GamificationRules.totalXpForLevel(5)).isEqualTo(1000);
    }

    @Test
    void levelForXp() {
        assertThat(GamificationRules.levelFor(0)).isEqualTo(1);
        assertThat(GamificationRules.levelFor(99)).isEqualTo(1);
        assertThat(GamificationRules.levelFor(100)).isEqualTo(2);
        assertThat(GamificationRules.levelFor(299)).isEqualTo(2);
        assertThat(GamificationRules.levelFor(300)).isEqualTo(3);
        assertThat(GamificationRules.levelFor(1000)).isEqualTo(5);
    }

    @Test
    void xpIntoAndForNextLevel() {
        // 150 XP -> level 2 (starts at 100), 50 into level, level 2 spans 100..300 = 200
        assertThat(GamificationRules.xpIntoLevel(150)).isEqualTo(50);
        assertThat(GamificationRules.xpForNextLevel(150)).isEqualTo(200);
    }

    @Test
    void streakStartsAtOneWhenNoHistory() {
        assertThat(GamificationRules.nextStreak(null, LocalDate.of(2026, 6, 27), 0)).isEqualTo(1);
    }

    @Test
    void streakUnchangedSameDay() {
        LocalDate today = LocalDate.of(2026, 6, 27);
        assertThat(GamificationRules.nextStreak(today, today, 4)).isEqualTo(4);
    }

    @Test
    void streakIncrementsFromYesterday() {
        LocalDate today = LocalDate.of(2026, 6, 27);
        assertThat(GamificationRules.nextStreak(today.minusDays(1), today, 4)).isEqualTo(5);
    }

    @Test
    void streakResetsAfterGap() {
        LocalDate today = LocalDate.of(2026, 6, 27);
        assertThat(GamificationRules.nextStreak(today.minusDays(3), today, 4)).isEqualTo(1);
    }
}
