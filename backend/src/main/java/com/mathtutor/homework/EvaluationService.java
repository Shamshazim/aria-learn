package com.mathtutor.homework;

import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.practice.AnswerMatcher;
import com.mathtutor.practice.QuestionBank;
import com.mathtutor.practice.QuestionBankRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Evaluates submitted homework asynchronously so the student is never blocked.
 * Multiple-choice answers are graded deterministically; open answers are graded by
 * the AI with partial credit, kind feedback, and misconception detection.
 */
@Service
public class EvaluationService {

    private static final Logger log = LoggerFactory.getLogger(EvaluationService.class);

    private final HomeworkAssignmentRepository homeworkRepository;
    private final HomeworkAnswerRepository answerRepository;
    private final AiEvaluationRepository evaluationRepository;
    private final QuestionBankRepository questionRepository;
    private final GenerationService generationService;
    private final CurriculumService curriculumService;
    private final MasteryService masteryService;
    private final com.mathtutor.gamification.GamificationService gamificationService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public EvaluationService(HomeworkAssignmentRepository homeworkRepository,
                             HomeworkAnswerRepository answerRepository,
                             AiEvaluationRepository evaluationRepository,
                             QuestionBankRepository questionRepository,
                             GenerationService generationService,
                             CurriculumService curriculumService,
                             MasteryService masteryService,
                             com.mathtutor.gamification.GamificationService gamificationService,
                             org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.homeworkRepository = homeworkRepository;
        this.answerRepository = answerRepository;
        this.evaluationRepository = evaluationRepository;
        this.questionRepository = questionRepository;
        this.generationService = generationService;
        this.curriculumService = curriculumService;
        this.masteryService = masteryService;
        this.gamificationService = gamificationService;
        this.eventPublisher = eventPublisher;
    }

    @Async
    @Transactional
    public void evaluateAsync(UUID homeworkId) {
        HomeworkAssignment hw = homeworkRepository.findById(homeworkId).orElse(null);
        if (hw == null || !"EVALUATING".equals(hw.getStatus())) {
            return;
        }
        try {
            TopicContext ctx = curriculumService.resolveTopicContext(hw.getTopicId());
            List<HomeworkAnswer> answers = answerRepository.findByHomeworkId(homeworkId);

            long creditSum = 0;
            Set<String> misconceptions = new LinkedHashSet<>();

            for (HomeworkAnswer ans : answers) {
                QuestionBank q = questionRepository.findById(ans.getQuestionId()).orElse(null);
                if (q == null) {
                    continue;
                }
                gradeAnswer(ans, q, ctx.subjectName(), hw.getStudentId());
                creditSum += ans.getPartialCredit();
                if (ans.getMisconception() != null && !ans.getMisconception().isBlank()) {
                    misconceptions.add(ans.getMisconception().trim());
                }
                answerRepository.save(ans);
            }

            int overall = answers.isEmpty() ? 0 : Math.round((float) creditSum / answers.size());

            AiEvaluation eval = new AiEvaluation();
            eval.setHomeworkId(homeworkId);
            eval.setOverallScore(overall);
            eval.setSummary(buildSummary(overall, ctx.topicName()));
            eval.setRecommendations(misconceptions.isEmpty()
                    ? "Great work — keep it up!"
                    : "Review these ideas: " + String.join("; ", misconceptions));
            evaluationRepository.save(eval);

            hw.setStatus("EVALUATED");
            hw.setScore(overall);
            hw.setEvaluatedAt(Instant.now());
            homeworkRepository.save(hw);

            // Feed the homework score into the mastery engine (the Homework component).
            masteryService.recordHomeworkScore(hw.getStudentId(), hw.getTopicId(), overall);

            // Award XP and check achievements for completing homework.
            gamificationService.onHomeworkEvaluated(hw.getStudentId(), overall);

            // Notify (after this async transaction commits).
            eventPublisher.publishEvent(
                    new com.mathtutor.notification.events.NotificationEvents.HomeworkGradedEvent(
                            hw.getStudentId(), hw.getTopicId(), overall));
        } catch (Exception e) {
            log.error("Homework evaluation failed for {}: {}", homeworkId, e.getMessage());
            hw.setStatus("ASSIGNED"); // allow the student to resubmit
            homeworkRepository.save(hw);
        }
    }

    private void gradeAnswer(HomeworkAnswer ans, QuestionBank q, String subjectName, UUID studentId) {
        if ("MULTIPLE_CHOICE".equalsIgnoreCase(q.getType())) {
            boolean correct = AnswerMatcher.matches(ans.getResponse(), q.getCorrectAnswer());
            ans.setCorrect(correct);
            ans.setPartialCredit(correct ? 100 : 0);
            ans.setFeedback(correct ? "Correct — nice work!"
                    : "Not quite. The correct answer is " + q.getCorrectAnswer() + ".");
            ans.setMisconception(null);
            return;
        }
        // Open-ended: let the AI grade with partial credit and feedback.
        AnswerEvaluation e = generationService.evaluateAnswer(subjectName, q.getPromptText(),
                q.getCorrectAnswer(), q.getSolution(), ans.getResponse(), studentId);
        ans.setCorrect(e.correct());
        ans.setPartialCredit(Math.max(0, Math.min(100, e.partialCredit())));
        ans.setFeedback(e.feedback());
        ans.setMisconception(e.misconception() == null || e.misconception().isBlank() ? null : e.misconception());
    }

    private String buildSummary(int overall, String topicName) {
        String praise;
        if (overall >= 90) {
            praise = "Outstanding work!";
        } else if (overall >= 70) {
            praise = "Good job — you are getting it!";
        } else if (overall >= 50) {
            praise = "Nice effort — a little more practice will help.";
        } else {
            praise = "Keep going — review the lesson and try again.";
        }
        return "You scored " + overall + "% on " + topicName + ". " + praise;
    }
}
