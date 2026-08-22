package com.mathtutor.mastery;

import com.mathtutor.mastery.MasteryCalculator.Components;
import com.mathtutor.mastery.MasteryCalculator.Outcome;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MasteryCalculatorTest {

    /** Default config: 20/30/20/30 weights, master at 80%. */
    private MasteryConfig config() {
        MasteryConfig c = new MasteryConfig();
        c.setWeightKnowledge(20);
        c.setWeightPractice(30);
        c.setWeightQuiz(20);
        c.setWeightHomework(30);
        c.setRequiredPct(80);
        c.setMaxQuizAttempts(3);
        return c;
    }

    @Test
    void knowledgeAloneCannotMaster() {
        // Opening the lesson gives knowledge=100, but no quiz means not mastered.
        Outcome o = MasteryCalculator.compute(config(), new Components(100, null, null, null));
        assertThat(o.total()).isEqualTo(100);
        assertThat(o.mastered()).isFalse();
    }

    @Test
    void renormalizesOverPresentComponents() {
        // Only quiz present -> total equals the quiz score (weight renormalized to itself).
        Outcome o = MasteryCalculator.compute(config(), new Components(null, null, 90, null));
        assertThat(o.total()).isEqualTo(90);
        assertThat(o.mastered()).isTrue();
    }

    @Test
    void weightedAverageAcrossThreeComponents() {
        // knowledge 100, practice 50, quiz 60 over weights 20/30/20 = (2000+1500+1200)/70 = 67
        Outcome o = MasteryCalculator.compute(config(), new Components(100, 50, 60, null));
        assertThat(o.total()).isEqualTo(67);
        assertThat(o.mastered()).isFalse();
    }

    @Test
    void mastersWhenWeightedTotalMeetsThresholdWithQuiz() {
        Outcome o = MasteryCalculator.compute(config(), new Components(100, 100, 100, 100));
        assertThat(o.total()).isEqualTo(100);
        assertThat(o.mastered()).isTrue();
    }

    @Test
    void thresholdIsInclusive() {
        // Quiz exactly at threshold (80) with only quiz present -> mastered.
        assertThat(MasteryCalculator.compute(config(), new Components(null, null, 80, null)).mastered()).isTrue();
        assertThat(MasteryCalculator.compute(config(), new Components(null, null, 79, null)).mastered()).isFalse();
    }

    @Test
    void noDataIsZeroAndNotMastered() {
        Outcome o = MasteryCalculator.compute(config(), new Components(null, null, null, null));
        assertThat(o.total()).isZero();
        assertThat(o.mastered()).isFalse();
    }
}
