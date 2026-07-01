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
    private final AnswerGrader grader = new AnswerGrader(generation, curriculum);

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

    @Test
    void multipleChoiceIsGradedByExactMatchWithoutAi() {
        QuestionBank mc = q("MULTIPLE_CHOICE", "B) 30");
        assertThat(grader.grade(mc, "B) 30", student).correct()).isTrue();
        assertThat(grader.grade(mc, "A) 25", student).correct()).isFalse();
        verifyNoInteractions(generation);
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
