package com.mathtutor.ai;

import com.mathtutor.ai.content.GeneratedQuestion;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Every case here is taken from a question the generator actually produced and stored, each of
 * which marked a child wrong no matter which option they clicked. The sanitizer must repair the
 * ones that are mechanically repairable and reject the rest — and, critically, must never resolve
 * a key onto an option it cannot be sure of.
 */
class QuestionSanitizerTest {

    private static GeneratedQuestion mc(String prompt, List<String> choices, String key) {
        return new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM", prompt, choices, key, "because");
    }

    private static GeneratedQuestion sanitized(GeneratedQuestion q) {
        QuestionSanitizer.Result r = QuestionSanitizer.sanitize(q);
        assertThat(r.rejected()).as("expected question to be kept, rejected: %s", r.rejection()).isFalse();
        return r.question();
    }

    private static String rejection(GeneratedQuestion q) {
        QuestionSanitizer.Result r = QuestionSanitizer.sanitize(q);
        assertThat(r.rejected()).as("expected question to be rejected").isTrue();
        return r.rejection();
    }

    // ── Repairs ──────────────────────────────────────────────────────────────

    @Test
    void anchorsAKeyThatIsMissingItsOptionLabel() {
        GeneratedQuestion q = sanitized(mc("What is 12 + 7?",
                List.of("A) 17", "B) 19", "C) 21", "D) 23"), "19"));

        assertThat(q.correctAnswer()).isEqualTo("B) 19");
    }

    @Test
    void anchorsAKeyThatCarriesALabelTheOptionsLack() {
        GeneratedQuestion q = sanitized(mc("What is 12 + 7?",
                List.of("17", "19", "21", "23"), "B) 19"));

        assertThat(q.correctAnswer()).isEqualTo("19");
    }

    @Test
    void resolvesABareLetterKeyToTheOptionCarryingThatLabel() {
        GeneratedQuestion q = sanitized(mc("What is 12 + 7?",
                List.of("A) 17", "B) 19", "C) 21", "D) 23"), "B"));

        assertThat(q.correctAnswer()).isEqualTo("B) 19");
    }

    @Test
    void resolvesABareLetterKeyByPositionWhenTheOptionsAreUnlabelled() {
        GeneratedQuestion q = sanitized(mc("What is 12 + 7?",
                List.of("17", "19", "21", "23"), "B"));

        assertThat(q.correctAnswer()).isEqualTo("19");
    }

    @Test
    void splitsOptionsThatArrivedCrammedIntoOneString() {
        // Stored as a single-element choices array, so the UI rendered one giant button.
        GeneratedQuestion q = sanitized(mc("Which one has 4 in the tens place?",
                List.of("A) 23 B) 41 C) 45 D) 67"), "C) 45"));

        assertThat(q.choices()).containsExactly("A) 23", "B) 41", "C) 45", "D) 67");
        assertThat(q.correctAnswer()).isEqualTo("C) 45");
    }

    @Test
    void stripsTheCorrectMarkerThatGivesTheAnswerAway() {
        GeneratedQuestion q = sanitized(mc("Which digit is in the thousandths place in the number 0.4567?",
                List.of("A) 4", "B) 5", "C) 6 (Correct)", "D) 7"), "C) 6"));

        assertThat(q.choices()).containsExactly("A) 4", "B) 5", "C) 6", "D) 7");
        assertThat(q.correctAnswer()).isEqualTo("C) 6");
    }

    @Test
    void removesOptionsDuplicatedIntoThePromptText() {
        GeneratedQuestion q = sanitized(mc("Which of these is not a complete sentence?\nA) The cat.\nB) The cat sleeps.",
                List.of("The cat.", "The cat sleeps on the couch.", "On the roof.", "A bird singing."),
                "The cat."));

        assertThat(q.prompt()).isEqualTo("Which of these is not a complete sentence?");
    }

    @Test
    void toleratesATrailingFullStopOnEitherSide() {
        GeneratedQuestion q = sanitized(mc("Which of these is a complete sentence?",
                List.of("A) The sun shines", "B) In the morning.", "C) On the beach.", "D) Beautiful day."),
                "A) The sun shines."));

        assertThat(q.correctAnswer()).isEqualTo("A) The sun shines");
    }

    @Test
    void matchesTheSameNumberWrittenDifferently() {
        GeneratedQuestion q = sanitized(mc("What is the value of the digit 5 in 3,654,281?",
                List.of("A) 5", "B) 500", "C) 5,000", "D) 50000"), "50,000"));

        assertThat(q.correctAnswer()).isEqualTo("D) 50000");
    }

    // ── Rejections ───────────────────────────────────────────────────────────

    @Test
    void rejectsAKeyThatNamesNoOption() {
        // 789 × 4 is 3156; the model wrote the right key but four wrong distractors.
        String why = rejection(mc("What is 789 multiplied by 4?",
                List.of("3150", "3160", "3140", "3170"), "3156"));

        assertThat(why).contains("not one of the options");
    }

    @Test
    void rejectsAKeyThatNamesSeveralOptionsAtOnce() {
        String why = rejection(mc("Which of these numbers rounds to 300 when rounded to the nearest hundred?",
                List.of("A) 256", "B) 347", "C) 289", "D) 314"), "A) 256 and C) 289"));

        assertThat(why).contains("more than one option");
    }

    @Test
    void rejectsAMultiLineKeyListingEveryOption() {
        String why = rejection(mc("What should be added at the end of this sentence?",
                List.of("a. in the park", "b. with toys", "c. in the garden", "d. on the playground"),
                "a. in the park, b. with toys, c. in the garden, d. on the playground"));

        assertThat(why).contains("more than one option");
    }

    @Test
    void rejectsDuplicateOptions() {
        String why = rejection(mc("If you have $920 and spend $485, how much is left?",
                List.of("$1405", "$435", "$135", "$435"), "$435"));

        assertThat(why).contains("identical");
    }

    @Test
    void rejectsAQuestionLeftWithTooFewOptions() {
        String why = rejection(mc("What is 2 + 2?", List.of("4", "5"), "4"));

        assertThat(why).contains("usable option");
    }

    @Test
    void rejectsAnEmptyPrompt() {
        assertThat(rejection(mc("   ", List.of("A) 1", "B) 2", "C) 3"), "A) 1"))).contains("prompt is empty");
    }

    @Test
    void rejectsAMultipleChoiceQuestionWithNoOptions() {
        assertThat(rejection(mc("What is 2 + 2?", List.of(), "4"))).contains("no options");
    }

    @Test
    void neverGuessesBetweenTwoOptionsAKeyCouldMean() {
        // Two options reduce to the same value once labels are ignored — resolving the key would
        // be a coin flip, so the question is rejected instead.
        String why = rejection(mc("Pick the right one.",
                List.of("A) 5", "B) 5 ", "C) 6", "D) 7"), "5"));

        assertThat(why).contains("identical");
    }

    // ── HTML markup ──────────────────────────────────────────────────────────

    @Test
    void stripsBreakTagsAndTheOptionsTheySeparateOutOfThePrompt() {
        // Verbatim from a Grade 7 English Writing question a child was shown: the model wrote its
        // line breaks as "<br>", so the prompt carried no newline, the option-stripping never ran,
        // and the child read the question, then all four options twice, tags and all.
        GeneratedQuestion q = sanitized(mc(
                "Which of the following uses a gerund as the main verb of the sentence? <br> <br> "
                        + "A) Running in the park makes me feel alive. <br> "
                        + "B) After running for an hour, I felt tired. <br> "
                        + "C) The fastest way to improve fitness is by running regularly. <br> "
                        + "D) I enjoy running more than swimming.",
                List.of("A) Running in the park makes me feel alive.",
                        "B) After running for an hour, I felt tired.",
                        "C) The fastest way to improve fitness is by running regularly.",
                        "D) I enjoy running more than swimming."),
                "A"));

        assertThat(q.prompt())
                .isEqualTo("Which of the following uses a gerund as the main verb of the sentence?");
        assertThat(q.choices()).hasSize(4);
        assertThat(q.correctAnswer()).isEqualTo("A) Running in the park makes me feel alive.");
    }

    @Test
    void stripsMarkupFromOptionsTheKeyAndTheSolution() {
        GeneratedQuestion q = sanitized(new GeneratedQuestion(
                "MULTIPLE_CHOICE", "MEDIUM", "<p>What is 12 + 7?</p>",
                List.of("A) <b>17</b>", "B) 19", "C) 21", "D) 23"),
                "B) <b>19</b>", "Add the <strong>ones</strong> first.<br>Then the tens."));

        assertThat(q.prompt()).isEqualTo("What is 12 + 7?");
        assertThat(q.choices()).containsExactly("A) 17", "B) 19", "C) 21", "D) 23");
        assertThat(q.correctAnswer()).isEqualTo("B) 19");
        assertThat(q.solution()).isEqualTo("Add the ones first. Then the tens.");
    }

    @Test
    void splitsAChoiceBlobJoinedByBreakTagsRatherThanSpaces() {
        GeneratedQuestion q = sanitized(mc("What is 12 + 7?",
                List.of("A) 17<br>B) 19<br>C) 21<br>D) 23"), "19"));

        assertThat(q.choices()).containsExactly("A) 17", "B) 19", "C) 21", "D) 23");
        assertThat(q.correctAnswer()).isEqualTo("B) 19");
    }

    @Test
    void decodesEscapedTagsAndEntities() {
        GeneratedQuestion q = sanitized(mc(
                "Which sign is right?&lt;br&gt;A) 3 &lt; 5&lt;br&gt;B) 3 &gt; 5&lt;br&gt;C) 3 = 5",
                List.of("A) 3 &lt; 5", "B) 3 &gt; 5", "C) 3 = 5"), "A"));

        assertThat(q.prompt()).isEqualTo("Which sign is right?");
        assertThat(q.choices()).containsExactly("A) 3 < 5", "B) 3 > 5", "C) 3 = 5");
    }

    @Test
    void leavesArithmeticComparisonsAlone() {
        // "< 5" and "> 2" are not markup. A generic <tag> pattern would eat half the question.
        GeneratedQuestion q = sanitized(mc("Is 3 < 5 and 9 > 2?",
                List.of("A) Yes", "B) No", "C) Only the first"), "A"));

        assertThat(q.prompt()).isEqualTo("Is 3 < 5 and 9 > 2?");
    }

    @Test
    void turnsADoubleEscapedNewlineBackIntoALineBreak() {
        GeneratedQuestion q = sanitized(mc("Pick the even number.\\nA) 3\\nB) 4\\nC) 5",
                List.of("A) 3", "B) 4", "C) 5"), "B"));

        assertThat(q.prompt()).isEqualTo("Pick the even number.");
    }

    // ── Short answer ─────────────────────────────────────────────────────────

    @Test
    void keepsShortAnswerQuestionsAndTidiesTheirKey() {
        GeneratedQuestion q = sanitized(new GeneratedQuestion(
                "SHORT_ANSWER", "EASY", "What is 12 + 7?", List.of(), "  19  ", "add them"));

        assertThat(q.correctAnswer()).isEqualTo("19");
    }

    @Test
    void rejectsAShortAnswerQuestionWithNoKey() {
        assertThat(rejection(new GeneratedQuestion(
                "SHORT_ANSWER", "EASY", "What is 12 + 7?", List.of(), "", "add them")))
                .contains("no correct answer");
    }
}
