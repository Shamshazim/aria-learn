package com.mathtutor.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.PracticeBatch;
import com.mathtutor.ai.content.VerifiedAnswerKeys;
import com.mathtutor.ai.content.VerifiedAnswerKeys.VerifiedKey;
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
        return new GenerationService(ai, mapper);
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
}
