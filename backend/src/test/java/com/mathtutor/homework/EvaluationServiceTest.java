package com.mathtutor.homework;

import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.practice.QuestionBank;
import com.mathtutor.practice.QuestionBankRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EvaluationServiceTest {

    private final HomeworkAssignmentRepository hwRepo = mock(HomeworkAssignmentRepository.class);
    private final HomeworkAnswerRepository answerRepo = mock(HomeworkAnswerRepository.class);
    private final AiEvaluationRepository evalRepo = mock(AiEvaluationRepository.class);
    private final QuestionBankRepository questionRepo = mock(QuestionBankRepository.class);
    private final GenerationService generation = mock(GenerationService.class);
    private final CurriculumService curriculum = mock(CurriculumService.class);
    private final MasteryService mastery = mock(MasteryService.class);
    private final com.mathtutor.gamification.GamificationService gamification =
            mock(com.mathtutor.gamification.GamificationService.class);

    private final EvaluationService service = new EvaluationService(
            hwRepo, answerRepo, evalRepo, questionRepo, generation, curriculum, mastery, gamification,
            mock(org.springframework.context.ApplicationEventPublisher.class));

    private QuestionBank q(String type, String correct) {
        QuestionBank q = new QuestionBank();
        q.setId(UUID.randomUUID());
        q.setType(type);
        q.setPromptText("Q?");
        q.setCorrectAnswer(correct);
        q.setSolution("sol");
        return q;
    }

    private HomeworkAnswer ans(UUID hwId, UUID questionId, String response) {
        HomeworkAnswer a = new HomeworkAnswer();
        a.setId(UUID.randomUUID());
        a.setHomeworkId(hwId);
        a.setQuestionId(questionId);
        a.setResponse(response);
        return a;
    }

    @Test
    void gradesMcDeterministicallyAndOpenViaAiThenAveragesAndFeedsMastery() {
        UUID hwId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID topicId = UUID.randomUUID();

        HomeworkAssignment hw = new HomeworkAssignment();
        hw.setId(hwId);
        hw.setStudentId(studentId);
        hw.setTopicId(topicId);
        hw.setStatus("EVALUATING");

        QuestionBank mc = q("MULTIPLE_CHOICE", "30");
        QuestionBank open = q("SHORT_ANSWER", "24");
        HomeworkAnswer aMc = ans(hwId, mc.getId(), "30");      // correct -> 100
        HomeworkAnswer aOpen = ans(hwId, open.getId(), "22");  // AI gives 50

        when(hwRepo.findById(hwId)).thenReturn(Optional.of(hw));
        when(answerRepo.findByHomeworkId(hwId)).thenReturn(List.of(aMc, aOpen));
        when(questionRepo.findById(mc.getId())).thenReturn(Optional.of(mc));
        when(questionRepo.findById(open.getId())).thenReturn(Optional.of(open));
        when(curriculum.resolveTopicContext(topicId))
                .thenReturn(new TopicContext(topicId, "Topic", "Grade 4", "Mathematics", ""));
        when(generation.evaluateAnswer(eq("Mathematics"), anyString(), eq("24"), anyString(), eq("22"), any()))
                .thenReturn(new AnswerEvaluation(false, 50, "Close — recheck the regrouping.", "regrouping"));
        when(answerRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(evalRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(hwRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        service.evaluateAsync(hwId);

        // MC graded without the AI
        assertThat(aMc.isCorrect()).isTrue();
        assertThat(aMc.getPartialCredit()).isEqualTo(100);
        // Open graded by the AI with partial credit + misconception
        assertThat(aOpen.isCorrect()).isFalse();
        assertThat(aOpen.getPartialCredit()).isEqualTo(50);
        assertThat(aOpen.getMisconception()).isEqualTo("regrouping");

        // Overall = (100 + 50) / 2 = 75, homework marked evaluated and fed to mastery
        assertThat(hw.getStatus()).isEqualTo("EVALUATED");
        assertThat(hw.getScore()).isEqualTo(75);
        verify(mastery).recordHomeworkScore(studentId, topicId, 75);

        ArgumentCaptor<AiEvaluation> evalCap = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(evalRepo).save(evalCap.capture());
        assertThat(evalCap.getValue().getOverallScore()).isEqualTo(75);
        assertThat(evalCap.getValue().getRecommendations()).contains("regrouping");
    }

    @Test
    void ignoresHomeworkNotInEvaluatingState() {
        UUID hwId = UUID.randomUUID();
        HomeworkAssignment hw = new HomeworkAssignment();
        hw.setId(hwId);
        hw.setStatus("EVALUATED");
        when(hwRepo.findById(hwId)).thenReturn(Optional.of(hw));

        service.evaluateAsync(hwId);

        verifyNoInteractions(generation, mastery);
    }
}
