package com.mathtutor.quiz;

import com.mathtutor.auth.Role;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.practice.QuestionBank;
import com.mathtutor.practice.QuestionBankRepository;
import com.mathtutor.quiz.dto.QuizDtos.QuizResult;
import com.mathtutor.quiz.dto.QuizDtos.SubmitQuizRequest;
import com.mathtutor.quiz.dto.QuizDtos.SubmittedAnswer;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class QuizServiceTest {

    private final QuizRepository quizRepo = mock(QuizRepository.class);
    private final QuizQuestionRepository quizQuestionRepo = mock(QuizQuestionRepository.class);
    private final AttemptRepository attemptRepo = mock(AttemptRepository.class);
    private final StudentAnswerRepository answerRepo = mock(StudentAnswerRepository.class);
    private final QuestionBankRepository questionRepo = mock(QuestionBankRepository.class);

    private final com.mathtutor.mastery.MasteryService masteryService =
            mock(com.mathtutor.mastery.MasteryService.class);
    private final com.mathtutor.homework.HomeworkService homeworkService =
            mock(com.mathtutor.homework.HomeworkService.class);
    private final com.mathtutor.gamification.GamificationService gamificationService =
            mock(com.mathtutor.gamification.GamificationService.class);
    private final com.mathtutor.practice.AnswerGrader answerGrader =
            mock(com.mathtutor.practice.AnswerGrader.class);

    private final QuizService service = new QuizService(
            quizRepo, quizQuestionRepo, attemptRepo, answerRepo, questionRepo, null, null, null,
            null, masteryService, homeworkService, gamificationService, answerGrader);

    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), Role.STUDENT, "Test Student");

    private QuestionBank question(String correct) {
        QuestionBank q = new QuestionBank();
        q.setId(UUID.randomUUID());
        q.setPromptText("What is it?");
        q.setCorrectAnswer(correct);
        q.setSolution("because");
        return q;
    }

    private QuizQuestion link(UUID quizId, UUID questionId, int order) {
        QuizQuestion l = new QuizQuestion();
        l.setQuizId(quizId);
        l.setQuestionId(questionId);
        l.setOrdering(order);
        return l;
    }

    @org.junit.jupiter.api.BeforeEach
    void stubGrader() {
        // Grade by exact match in tests (mirrors closed-answer behavior).
        when(answerGrader.grade(any(), any(), any())).thenAnswer(inv -> {
            QuestionBank q = inv.getArgument(0);
            String resp = inv.getArgument(1);
            return new com.mathtutor.practice.AnswerGrader.GradeResult(
                    com.mathtutor.practice.AnswerMatcher.matches(resp, q.getCorrectAnswer()), "ok");
        });
    }

    @Test
    void gradesScoreAndPassFlag() {
        UUID quizId = UUID.randomUUID();
        Attempt attempt = new Attempt();
        attempt.setId(UUID.randomUUID());
        attempt.setStudentId(student.id());
        attempt.setActivityId(quizId);
        attempt.setStatus("IN_PROGRESS");

        Quiz quiz = new Quiz();
        quiz.setId(quizId);
        quiz.setPassingPct(80);

        QuestionBank q1 = question("30");
        QuestionBank q2 = question("24");

        when(attemptRepo.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(quizRepo.findById(quizId)).thenReturn(Optional.of(quiz));
        when(quizQuestionRepo.findByQuizIdOrderByOrdering(quizId))
                .thenReturn(List.of(link(quizId, q1.getId(), 0), link(quizId, q2.getId(), 1)));
        when(questionRepo.findById(q1.getId())).thenReturn(Optional.of(q1));
        when(questionRepo.findById(q2.getId())).thenReturn(Optional.of(q2));
        when(answerRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(attemptRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        // 1 of 2 correct -> 50% -> below 80% passing
        QuizResult result = service.submit(student, new SubmitQuizRequest(attempt.getId(), List.of(
                new SubmittedAnswer(q1.getId(), "30"),
                new SubmittedAnswer(q2.getId(), "20"))));

        assertThat(result.correct()).isEqualTo(1);
        assertThat(result.total()).isEqualTo(2);
        assertThat(result.scorePct()).isEqualTo(50);
        assertThat(result.passed()).isFalse();
        assertThat(attempt.getStatus()).isEqualTo("SUBMITTED");
        assertThat(attempt.getScorePct()).isEqualTo(50);
        verify(answerRepo, times(2)).save(any());
    }

    @Test
    void passesWhenScoreMeetsThreshold() {
        UUID quizId = UUID.randomUUID();
        Attempt attempt = new Attempt();
        attempt.setId(UUID.randomUUID());
        attempt.setStudentId(student.id());
        attempt.setActivityId(quizId);
        attempt.setStatus("IN_PROGRESS");

        Quiz quiz = new Quiz();
        quiz.setId(quizId);
        quiz.setPassingPct(80);

        QuestionBank q1 = question("30");

        when(attemptRepo.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(quizRepo.findById(quizId)).thenReturn(Optional.of(quiz));
        when(quizQuestionRepo.findByQuizIdOrderByOrdering(quizId))
                .thenReturn(List.of(link(quizId, q1.getId(), 0)));
        when(questionRepo.findById(q1.getId())).thenReturn(Optional.of(q1));
        when(answerRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(attemptRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        QuizResult result = service.submit(student, new SubmitQuizRequest(attempt.getId(),
                List.of(new SubmittedAnswer(q1.getId(), "30"))));

        assertThat(result.scorePct()).isEqualTo(100);
        assertThat(result.passed()).isTrue();
    }

    @Test
    void rejectsResubmissionOfSubmittedAttempt() {
        Attempt attempt = new Attempt();
        attempt.setId(UUID.randomUUID());
        attempt.setStudentId(student.id());
        attempt.setStatus("SUBMITTED");
        when(attemptRepo.findById(attempt.getId())).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.submit(student,
                new SubmitQuizRequest(attempt.getId(), List.of())))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAttemptOwnedByAnotherStudent() {
        Attempt attempt = new Attempt();
        attempt.setId(UUID.randomUUID());
        attempt.setStudentId(UUID.randomUUID()); // someone else
        attempt.setStatus("IN_PROGRESS");
        when(attemptRepo.findById(attempt.getId())).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.submit(student,
                new SubmitQuizRequest(attempt.getId(), List.of())))
                .isInstanceOf(ForbiddenException.class);
    }
}
