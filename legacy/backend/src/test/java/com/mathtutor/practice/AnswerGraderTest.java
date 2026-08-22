package com.mathtutor.practice;

import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.practice.AnswerGrader.GradeResult;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AnswerGraderTest {

    private final GenerationService generation = mock(GenerationService.class);
    private final CurriculumService curriculum = mock(CurriculumService.class);
    private final QuestionStore store =
            new QuestionStore(mock(QuestionBankRepository.class), new com.fasterxml.jackson.databind.ObjectMapper());
    private final AnswerGrader grader = new AnswerGrader(generation, curriculum, store);

    private final UUID student = UUID.randomUUID();

    private QuestionBank q(String type, String correct) {
        QuestionBank q = new QuestionBank();
        q.setId(UUID.randomUUID());
        q.setTopicId(UUID.randomUUID());
        q.setType(type);
        q.setPromptText("Question?");
        q.setCorrectAnswer(correct);
        q.setSolution("because");
        return q;
    }

    private QuestionBank mc(String correct, String... choices) {
        QuestionBank q = q("MULTIPLE_CHOICE", correct);
        q.setChoices(store.writeChoices(java.util.List.of(choices)));
        return q;
    }

    @Test
    void multipleChoiceIsGradedByExactMatchWithoutAi() {
        QuestionBank mc = q("MULTIPLE_CHOICE", "B) 30");
        assertThat(grader.grade(mc, "B) 30", student).correct()).isTrue();
        assertThat(grader.grade(mc, "A) 25", student).correct()).isFalse();
        verifyNoInteractions(generation);
    }

    // ── Questions already in the bank whose key names its option in a different form. The child
    //    clicks the option text, so a plain comparison marks them wrong however they answer. ──

    @Test
    void bareLetterKeyGradesTheOptionItNamesRatherThanNobody() {
        QuestionBank mc = mc("B", "17", "19", "21", "23");

        assertThat(grader.grade(mc, "19", student).correct()).isTrue();
        assertThat(grader.grade(mc, "17", student).correct()).isFalse();
    }

    @Test
    void keyMissingItsOptionLabelStillGradesCorrectly() {
        QuestionBank mc = mc("19", "A) 17", "B) 19", "C) 21", "D) 23");

        GradeResult r = grader.grade(mc, "B) 19", student);

        assertThat(r.correct()).isTrue();
        // The reveal names the option the child can actually see, so the UI highlights it.
        assertThat(r.correctAnswer()).isEqualTo("B) 19");
    }

    @Test
    void keyCarryingAnOptionLabelTheChoicesLackStillGradesCorrectly() {
        QuestionBank mc = mc("C) 21", "17", "19", "21", "23");

        assertThat(grader.grade(mc, "21", student).correct()).isTrue();
        assertThat(grader.grade(mc, "23", student).correct()).isFalse();
    }

    @Test
    void numericallyEqualChoiceIsAccepted() {
        QuestionBank mc = mc("0.50", "A) 0.5", "B) 5", "C) 50", "D) 500");

        assertThat(grader.grade(mc, "A) 0.5", student).correct()).isTrue();
    }

    @Test
    void keyNamingNoOptionIsGradedAsStoredAndNeverMarksAWrongOptionRight() {
        // 789 × 4 is 3156, but no option holds it — the question is unwinnable. It must not
        // silently promote some other option to "correct".
        QuestionBank mc = mc("3156", "3150", "3160", "3140", "3170");

        assertThat(grader.grade(mc, "3150", student).correct()).isFalse();
        assertThat(grader.grade(mc, "3160", student).correct()).isFalse();
    }

    @Test
    void ambiguousKeyIsNeverGuessedBetweenDuplicateOptions() {
        QuestionBank mc = mc("435", "$1405", "$435", "$135", "$435");

        assertThat(grader.grade(mc, "$435", student).correct()).isFalse();
    }

    @Test
    void shortAnswerExactMatchSkipsAi() {
        QuestionBank sa = q("SHORT_ANSWER", "56");
        GradeResult r = grader.grade(sa, " 56 ", student);
        assertThat(r.correct()).isTrue();
        verifyNoInteractions(generation);
    }

    @Test
    void openShortAnswerIsJudgedByAiAndAcceptsValidAlternatives() {
        QuestionBank sa = q("SHORT_ANSWER", "The dog runs."); // stored example
        when(curriculum.resolveTopicContext(sa.getTopicId()))
                .thenReturn(new TopicContext(sa.getTopicId(), "Sentences", "Grade 4", "English Writing", ""));
        when(generation.checkShortAnswer(eq("English Writing"), anyString(), eq("The dog runs."), eq("I eat breakfast."), any()))
                .thenReturn(new AnswerEvaluation(true, 100, "Great sentence with a subject and a predicate!", ""));

        GradeResult r = grader.grade(sa, "I eat breakfast.", student);

        assertThat(r.correct()).isTrue(); // a different but valid answer is accepted
        assertThat(r.feedback()).contains("Great sentence");
    }

    @Test
    void openShortAnswerCanBeJudgedWrong() {
        QuestionBank sa = q("SHORT_ANSWER", "The dog runs.");
        when(curriculum.resolveTopicContext(any()))
                .thenReturn(new TopicContext(sa.getTopicId(), "Sentences", "Grade 4", "English Writing", ""));
        when(generation.checkShortAnswer(any(), any(), any(), any(), any()))
                .thenReturn(new AnswerEvaluation(false, 0, "That is not a complete sentence.", "fragment"));

        GradeResult r = grader.grade(sa, "dog", student);

        assertThat(r.correct()).isFalse();
        assertThat(r.feedback()).contains("complete sentence");
    }
}
