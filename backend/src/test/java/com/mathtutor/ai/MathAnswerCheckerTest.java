package com.mathtutor.ai;

import com.mathtutor.ai.MathAnswerChecker.Outcome;
import com.mathtutor.ai.MathAnswerChecker.Verdict;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The deterministic checker must compute place-value answers exactly and, crucially, only ever
 * act when it is certain — the real questions below were pulled from the app's database, where the
 * local model had mislabelled many of them.
 */
class MathAnswerCheckerTest {

    // ── Family A: value of a digit ────────────────────────────────────────────

    @Test
    void valueOfDigit_picksCorrectChoice_andWouldFixWrongKeys() {
        // 5 is in the hundredths place of 34.256 → 0.05 (the DB key wrongly said 0.5).
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "What is the value of the digit 5 in the number 34.256?",
                List.of("A) 5", "B) 0.5", "C) 50", "D) 0.05"));
        assertThat(v.outcome()).isEqualTo(Outcome.CORRECT);
        assertThat(v.correctChoice()).isEqualTo("D) 0.05");
    }

    @Test
    void valueOfDigit_thousandths() {
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "What is the value of the digit 7 in the number 34.567?",
                List.of("A) 0.007", "B) 0.7", "C) 70", "D) 7"));
        assertThat(v.correctChoice()).isEqualTo("A) 0.007");
    }

    @Test
    void valueOfDigit_wholeNumberWithCommas() {
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "What is the value of the digit 5 in the number 3,654,281?",
                List.of("A) 5", "B) 500", "C) 5,000", "D) 50,000"));
        assertThat(v.correctChoice()).isEqualTo("D) 50,000");
    }

    @Test
    void valueOfDigit_flagsBrokenQuestionWithNoCorrectOption() {
        // 8 is in the hundred-thousandths place of 123.45678 → 0.00008, which is not an option.
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "What is the value of the digit 8 in the number 123.45678?",
                List.of("A) 8", "B) 0.0008", "C) 0.008", "D) 0.08"));
        assertThat(v.outcome()).isEqualTo(Outcome.NO_CORRECT_OPTION);
    }

    @Test
    void valueOfDigit_defersWhenCorrectOptionIsWorded() {
        // Correct answer "5 hundredths" is a worded choice we don't parse — defer, don't guess.
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "What is the value of the digit 5 in the number 34.256?",
                List.of("A) 5 tenths", "B) 5 hundredths", "C) 5 thousandths", "D) 5"));
        assertThat(v.outcome()).isEqualTo(Outcome.UNKNOWN);
    }

    // ── Family B: which digit is in the ⟨place⟩ place ─────────────────────────

    @Test
    void whichDigitInPlace_thousandths() {
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "Which digit is in the thousandths place in the number 34.267?",
                List.of("A) 3", "B) 4", "C) 6", "D) 7"));
        assertThat(v.correctChoice()).isEqualTo("D) 7");
    }

    @Test
    void whichDigitInPlace_ofNumber() {
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "Which digit is in the thousandths place of the number 0.4321?",
                List.of("A) 4", "B) 3", "C) 2", "D) 1"));
        assertThat(v.correctChoice()).isEqualTo("C) 2");
    }

    // ── Family C: which number has digit D in the ⟨place⟩ place ───────────────

    @Test
    void whichNumberHasDigitInPlace_uniqueMatch() {
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "Which of these numbers has a 7 in the thousandths place?",
                List.of("A) 1234.5678", "B) 123.4567", "C) 12.3456", "D) 1.2345"));
        assertThat(v.correctChoice()).isEqualTo("A) 1234.5678");
    }

    @Test
    void whichNumberHasDigitInPlace_defersWhenAmbiguous() {
        // Both 12.034 and 12.430 have a 3 in the hundredths place — ambiguous, so defer.
        Verdict v = MathAnswerChecker.checkMultipleChoice(
                "Which of the following numbers has a 3 in the hundredths place?",
                List.of("A) 12.345", "B) 12.034", "C) 12.304", "D) 12.430"));
        assertThat(v.outcome()).isEqualTo(Outcome.UNKNOWN);
    }

    // ── Non-math / unparseable questions defer ────────────────────────────────

    @Test
    void defersOnQuestionsItCannotCompute() {
        assertThat(MathAnswerChecker.checkMultipleChoice(
                "Which of the following is equivalent to 634.921?",
                List.of("A) 600 + 30 + 4 + 0.9 + 0.021", "B) 600 + 30 + 4 + 0.92 + 0.01")).outcome())
                .isEqualTo(Outcome.UNKNOWN);
        assertThat(MathAnswerChecker.checkMultipleChoice(
                "Which noun is a proper noun?", List.of("A) dog", "B) London")).outcome())
                .isEqualTo(Outcome.UNKNOWN);
    }

    // ── Short answer ──────────────────────────────────────────────────────────

    @Test
    void solveNumeric_valueOfDigitInOnesPlace() {
        // The DB key said "300" but 3 is in the ONES place of 123.456 → value 3.
        assertThat(MathAnswerChecker.solveNumeric("What is the value of the digit 3 in the number 123.456?"))
                .contains(new BigDecimal("3"));
    }

    @Test
    void solveNumeric_defersOnConstructivePrompts() {
        assertThat(MathAnswerChecker.solveNumeric("Write the number 3 in the thousandths place.")).isEmpty();
        assertThat(MathAnswerChecker.solveNumeric("Write the number 564.9 in words.")).isEmpty();
    }

    // ── Primitives & numeric equality ─────────────────────────────────────────

    @Test
    void placeAndDigitPrimitives() {
        assertThat(MathAnswerChecker.placeExponent("hundredths")).hasValue(-2);
        assertThat(MathAnswerChecker.placeExponent("ten-thousands")).hasValue(4);
        assertThat(MathAnswerChecker.uniqueDigitExponent("34.256", 5)).hasValue(-2);
        assertThat(MathAnswerChecker.uniqueDigitExponent("77.237", 7)).isEmpty(); // 7 appears twice → not unique
        assertThat(MathAnswerChecker.digitAtExponent("34.267", -3)).hasValue(7);
    }

    @Test
    void numericEquals_toleratesFormatting() {
        assertThat(MathAnswerChecker.numericEquals("0.5", "0.50")).isTrue();
        assertThat(MathAnswerChecker.numericEquals("1,000", "1000")).isTrue();
        assertThat(MathAnswerChecker.numericEquals("0.05", "5 hundredths")).isFalse();
        assertThat(MathAnswerChecker.numericEquals("3", "300")).isFalse();
    }
}
