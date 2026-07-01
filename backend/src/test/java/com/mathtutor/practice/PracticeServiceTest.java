package com.mathtutor.practice;

import com.mathtutor.auth.Role;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.practice.AnswerGrader.GradeResult;
import com.mathtutor.practice.dto.PracticeDtos.AnswerRequest;
import com.mathtutor.practice.dto.PracticeDtos.AnswerResult;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class PracticeServiceTest {

    private final QuestionBankRepository questionRepo = mock(QuestionBankRepository.class);
    private final MasteryService masteryService = mock(MasteryService.class);
    private final com.mathtutor.gamification.GamificationService gamificationService =
            mock(com.mathtutor.gamification.GamificationService.class);
    private final AnswerGrader answerGrader = mock(AnswerGrader.class);
    private final PracticeService service = new PracticeService(
            questionRepo, null, null, null, null, masteryService, gamificationService, answerGrader);

    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), Role.STUDENT, "Test Student");

    private QuestionBank question() {
        QuestionBank q = new QuestionBank();
        q.setId(UUID.randomUUID());
        q.setTopicId(UUID.randomUUID());
        q.setCorrectAnswer("30");
        q.setSolution("because math");
        return q;
    }

    @Test
    void returnsGraderVerdictAndRecordsResult() {
        QuestionBank q = question();
        when(questionRepo.findById(q.getId())).thenReturn(Optional.of(q));
        when(answerGrader.grade(eq(q), eq("30"), any())).thenReturn(new GradeResult(true, "Nice!"));

        AnswerResult r = service.checkAnswer(student, new AnswerRequest(q.getId(), "30"));

        assertThat(r.correct()).isTrue();
        assertThat(r.feedback()).isEqualTo("Nice!");
        assertThat(r.correctAnswer()).isEqualTo("30");
        verify(masteryService).recordPracticeResult(student.id(), q.getTopicId(), true);
        verify(gamificationService).onPracticeAnswered(student.id(), true);
    }

    @Test
    void wrongAnswerRecordsIncorrect() {
        QuestionBank q = question();
        when(questionRepo.findById(q.getId())).thenReturn(Optional.of(q));
        when(answerGrader.grade(eq(q), eq("25"), any())).thenReturn(new GradeResult(false, "Not quite."));

        AnswerResult r = service.checkAnswer(student, new AnswerRequest(q.getId(), "25"));

        assertThat(r.correct()).isFalse();
        verify(masteryService).recordPracticeResult(student.id(), q.getTopicId(), false);
    }
}
