package com.mathtutor.adaptive;

import com.mathtutor.adaptive.AdaptiveRules.RecType;
import com.mathtutor.adaptive.AdaptiveRules.TopicSignal;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AdaptiveRulesTest {

    private TopicSignal sig(int total, Integer practice, Integer quiz, Integer hw, boolean mastered) {
        return new TopicSignal(UUID.randomUUID(), total, practice, quiz, hw, mastered, 80);
    }

    @Test
    void strengthWhenMasteredOrHighTotal() {
        assertThat(AdaptiveRules.isStrength(sig(50, null, null, null, true))).isTrue();
        assertThat(AdaptiveRules.isStrength(sig(85, 90, 85, null, false))).isTrue();
        assertThat(AdaptiveRules.isStrength(sig(84, 80, null, null, false))).isFalse();
    }

    @Test
    void weaknessWhenLowTotalAndNotMastered() {
        assertThat(AdaptiveRules.isWeakness(sig(40, 40, null, null, false))).isTrue();
        assertThat(AdaptiveRules.isWeakness(sig(0, null, null, null, false))).isFalse();   // no activity
        assertThat(AdaptiveRules.isWeakness(sig(70, 70, null, null, false))).isFalse();    // not low enough
        assertThat(AdaptiveRules.isWeakness(sig(40, 40, null, null, true))).isFalse();     // mastered
    }

    @Test
    void recommendationsMatchTheDesignExamples() {
        assertThat(AdaptiveRules.recommend(sig(50, null, null, null, true)))
                .contains(RecType.INCREASE_DIFFICULTY);                 // mastered -> harder
        assertThat(AdaptiveRules.recommend(sig(45, 40, null, null, false)))
                .contains(RecType.MORE_PRACTICE);                       // low practice accuracy
        assertThat(AdaptiveRules.recommend(sig(65, 80, 60, null, false)))
                .contains(RecType.REVIEW);                              // below required, decent practice
        assertThat(AdaptiveRules.recommend(sig(0, null, null, null, false)))
                .isEmpty();                                             // no activity -> nothing
    }

    @Test
    void difficultyAdaptsToAccuracy() {
        assertThat(AdaptiveRules.suggestDifficulty(null)).isEqualTo("EASY");
        assertThat(AdaptiveRules.suggestDifficulty(40)).isEqualTo("EASY");
        assertThat(AdaptiveRules.suggestDifficulty(60)).isEqualTo("MEDIUM");
        assertThat(AdaptiveRules.suggestDifficulty(80)).isEqualTo("HARD");
        assertThat(AdaptiveRules.suggestDifficulty(95)).isEqualTo("CHALLENGE");
    }

    @Test
    void paceLabels() {
        assertThat(AdaptiveRules.pace(0, 0)).isEqualTo("NEW");
        assertThat(AdaptiveRules.pace(85, 2)).isEqualTo("FLYING");
        assertThat(AdaptiveRules.pace(65, 1)).isEqualTo("STEADY");
        assertThat(AdaptiveRules.pace(40, 0)).isEqualTo("BUILDING");
    }
}
