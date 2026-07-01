package com.mathtutor.practice;

import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.Hint;
import com.mathtutor.auth.Role;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.practice.dto.GuidedDtos.GuidedAttemptRequest;
import com.mathtutor.practice.dto.GuidedDtos.GuidedFeedback;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GuidedPracticeServiceTest {

    private final QuestionBankRepository questionRepo = mock(QuestionBankRepository.class);
    private final CurriculumService curriculum = mock(CurriculumService.class);
    private final GenerationService generation = mock(GenerationService.class);

    private final GuidedPracticeService service =
            new GuidedPracticeService(questionRepo, curriculum, generation, null, null);

    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), Role.STUDENT, "Test Student");

    private QuestionBank question() {
        QuestionBank q = new QuestionBank();
        q.setId(UUID.randomUUID());
        q.setTopicId(UUID.randomUUID());
        q.setPromptText("What is 6 x 5?");
        q.setCorrectAnswer("30");
        q.setSolution("Six groups of five make thirty.");
        return q;
    }

    @Test
    void correctAnswerRevealsSolutionAndNoHint() {
        QuestionBank q = question();
        when(questionRepo.findById(q.getId())).thenReturn(Optional.of(q));

        GuidedFeedback fb = service.attempt(student, new GuidedAttemptRequest(q.getId(), "30", 1));

        assertThat(fb.correct()).isTrue();
        assertThat(fb.solution()).isEqualTo("Six groups of five make thirty.");
        assertThat(fb.hint()).isNull();
        verifyNoInteractions(generation); // no hint generated when correct
    }

    @Test
    void wrongAnswerReturnsHintAndHidesSolution() {
        QuestionBank q = question();
        when(questionRepo.findById(q.getId())).thenReturn(Optional.of(q));
        when(curriculum.resolveTopicContext(q.getTopicId()))
                .thenReturn(new TopicContext(q.getTopicId(), "Multiplication", "Grade 4", "Mathematics", ""));
        when(generation.generateHint(eq("Mathematics"), anyString(), eq("25"), eq(2), any()))
                .thenReturn(new Hint("Try counting by fives six times."));

        GuidedFeedback fb = service.attempt(student, new GuidedAttemptRequest(q.getId(), "25", 2));

        assertThat(fb.correct()).isFalse();
        assertThat(fb.hint()).isEqualTo("Try counting by fives six times.");
        assertThat(fb.solution()).isNull(); // solution stays hidden so the child keeps trying
    }
}
