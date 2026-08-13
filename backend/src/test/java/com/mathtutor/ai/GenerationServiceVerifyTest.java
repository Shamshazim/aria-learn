package com.mathtutor.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.PracticeBatch;
import com.mathtutor.ai.content.VerifiedAnswerKeys;
import com.mathtutor.ai.content.VerifiedAnswerKeys.VerifiedKey;
import com.mathtutor.tutor.TutorModeService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The answer-key verifier must correct genuinely-wrong keys but must NOT overwrite a correct
 * key when it (a fallible local model) miscalculates. The guard is the question's own solution.
 */
class GenerationServiceVerifyTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private GenerationService serviceReturning(VerifiedAnswerKeys verified) {
        AiClient ai = mock(AiClient.class);
        when(ai.generateStructured(eq(GenerationService.PROMPT_ANSWER_VERIFY), any(),
                eq(VerifiedAnswerKeys.class), any())).thenReturn(verified);
        return new GenerationService(ai, mapper, mock(TutorModeService.class));
    }

    @Test
    void keepsCorrectKeyWhenVerifierMiscalculatesAgainstTheSolution() {
        // Correct key is D) 50,000 and the solution agrees. The verifier wrongly says 5,000.
        GeneratedQuestion q = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "What is the value of the digit 5 in the number 3,654,281?",
                List.of("A) 5", "B) 500", "C) 5,000", "D) 50,000"),
                "D) 50,000",
                "The digit 5 is in the ten-thousands place. Its value is 5 times 10,000, which equals 50,000.");
        GenerationService svc = serviceReturning(
                new VerifiedAnswerKeys(List.of(new VerifiedKey(0, "bad math", "C) 5,000"))));

        PracticeBatch out = svc.verifyAnswerKeys(new PracticeBatch(List.of(q)), "Mathematics", null);

        // The wrong "correction" is rejected because the solution backs 50,000, not 5,000.
        assertThat(out.questions().get(0).correctAnswer()).isEqualTo("D) 50,000");
    }

    @Test
    void correctsWrongKeyWhenSolutionBacksTheVerifiedAnswer() {
        // Key is wrong (A) 2.144), but the solution shows 2.444; the verifier agrees.
        GeneratedQuestion q = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "If you add 0.345 to a number and get 2.789, what was the original number?",
                List.of("A) 2.144", "B) 2.444", "C) 2.134", "D) 2.434"),
                "A) 2.144",
                "Subtract: 2.789 - 0.345 = 2.444.");
        GenerationService svc = serviceReturning(
                new VerifiedAnswerKeys(List.of(new VerifiedKey(0, "2.789-0.345=2.444", "B) 2.444"))));

        PracticeBatch out = svc.verifyAnswerKeys(new PracticeBatch(List.of(q)), "Mathematics", null);

        assertThat(out.questions().get(0).correctAnswer()).isEqualTo("B) 2.444");
    }

    /** A service whose model verifier returns nothing — isolates the deterministic pass. */
    private GenerationService deterministicOnly() {
        AiClient ai = mock(AiClient.class); // generateStructured returns null for any args
        return new GenerationService(ai, mapper, mock(TutorModeService.class));
    }

    @Test
    void deterministicallyFixesWrongPlaceValueKey_withoutTheModel() {
        // DB had this mislabelled as "B) 0.5"; 5 is in the hundredths place of 34.256 → 0.05.
        GeneratedQuestion q = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "What is the value of the digit 5 in the number 34.256?",
                List.of("A) 5", "B) 0.5", "C) 50", "D) 0.05"),
                "B) 0.5", "The digit 5 is in the hundredths place.");

        PracticeBatch out = deterministicOnly().verifyAnswerKeys(new PracticeBatch(List.of(q)), "Mathematics", null);

        assertThat(out.questions().get(0).correctAnswer()).isEqualTo("D) 0.05");
    }

    @Test
    void deterministicallyDropsBrokenQuestionWithNoCorrectOption() {
        GeneratedQuestion broken = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "What is the value of the digit 8 in the number 123.45678?",
                List.of("A) 8", "B) 0.0008", "C) 0.008", "D) 0.08"),
                "C) 0.008", "The digit 8 ...");
        GeneratedQuestion fine = new GeneratedQuestion("SHORT_ANSWER", "EASY",
                "Write the number 564.9 in words.", List.of(),
                "five hundred sixty-four and nine tenths", "");

        PracticeBatch out = deterministicOnly()
                .verifyAnswerKeys(new PracticeBatch(List.of(broken, fine)), "Mathematics", null);

        assertThat(out.questions()).hasSize(1);
        assertThat(out.questions().get(0).prompt()).contains("564.9");
    }

    @Test
    void structurallyBrokenQuestionsNeverReachTheChild() {
        // Each of these was marked wrong however the child answered: the options arrived as one
        // string, the key named two options at once, and the key named no option at all.
        GeneratedQuestion blob = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "Which one has 4 in the tens place?", List.of("A) 23 B) 41 C) 45 D) 67"), "C) 45", "");
        GeneratedQuestion twoKeys = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "Which of these numbers rounds to 300?", List.of("A) 256", "B) 347", "C) 289", "D) 314"),
                "A) 256 and C) 289", "");
        GeneratedQuestion noOption = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "What is 789 multiplied by 4?", List.of("3150", "3160", "3140", "3170"), "3156", "");

        PracticeBatch out = deterministicOnly()
                .verifyAnswerKeys(new PracticeBatch(List.of(blob, twoKeys, noOption)), "Mathematics", null);

        // The blob is repaired into four real options; the other two are unanswerable and dropped.
        assertThat(out.questions()).hasSize(1);
        assertThat(out.questions().get(0).choices()).containsExactly("A) 23", "B) 41", "C) 45", "D) 67");
    }

    @Test
    void topsTheSetBackUpWhenVerificationDropsQuestions() {
        GeneratedQuestion good = new GeneratedQuestion("SHORT_ANSWER", "EASY",
                "What is 2 + 2?", List.of(), "4", "");
        GeneratedQuestion alsoGood = new GeneratedQuestion("SHORT_ANSWER", "EASY",
                "What is 3 + 3?", List.of(), "6", "");
        GeneratedQuestion broken = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                "Pick one.", List.of("A) 1", "B) 2", "C) 3"), "D", "");

        AiClient ai = mock(AiClient.class);
        when(ai.generateStructured(eq(GenerationService.PROMPT_PRACTICE), any(),
                eq(PracticeBatch.class), any(), any()))
                .thenReturn(new PracticeBatch(List.of(good, broken)))   // first pass: one survives
                .thenReturn(new PracticeBatch(List.of(alsoGood)));      // top-up fills the gap
        GenerationService svc = new GenerationService(ai, mapper, mock(TutorModeService.class));

        PracticeBatch out = svc.generatePractice(
                new GenerationContext("Mathematics", "Grade 4", "Addition", ""), "EASY", 2, null);

        assertThat(out.questions()).extracting(GeneratedQuestion::prompt)
                .containsExactly("What is 2 + 2?", "What is 3 + 3?");
    }

    @Test
    void deterministicallyFixesWrongShortAnswerKey() {
        // DB had "300"; 3 is in the ones place of 123.456 → 3.
        GeneratedQuestion q = new GeneratedQuestion("SHORT_ANSWER", "MEDIUM",
                "What is the value of the digit 3 in the number 123.456?",
                List.of(), "300", "The digit 3 is in the ones place.");

        PracticeBatch out = deterministicOnly().verifyAnswerKeys(new PracticeBatch(List.of(q)), "Mathematics", null);

        assertThat(out.questions().get(0).correctAnswer()).isEqualTo("3");
    }
}
