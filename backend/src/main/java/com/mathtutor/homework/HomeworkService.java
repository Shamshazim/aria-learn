package com.mathtutor.homework;

import com.mathtutor.ai.GenerationContext;
import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.PracticeBatch;
import com.mathtutor.auth.StudentRepository;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.AiException;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.homework.dto.HomeworkDtos.*;
import com.mathtutor.practice.QuestionBank;
import com.mathtutor.practice.QuestionBankRepository;
import com.mathtutor.practice.QuestionStore;
import com.mathtutor.progress.ProgressService;
import com.mathtutor.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class HomeworkService {

    private static final Logger log = LoggerFactory.getLogger(HomeworkService.class);
    private static final int HOMEWORK_QUESTION_COUNT = 5;

    private final HomeworkAssignmentRepository homeworkRepository;
    private final HomeworkQuestionRepository homeworkQuestionRepository;
    private final HomeworkAnswerRepository answerRepository;
    private final AiEvaluationRepository evaluationRepository;
    private final QuestionBankRepository questionRepository;
    private final QuestionStore questionStore;
    private final CurriculumService curriculumService;
    private final GenerationService generationService;
    private final ProgressService progressService;
    private final StudentRepository studentRepository;
    private final SettingsService settingsService;
    private final EvaluationService evaluationService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public HomeworkService(HomeworkAssignmentRepository homeworkRepository,
                           HomeworkQuestionRepository homeworkQuestionRepository,
                           HomeworkAnswerRepository answerRepository,
                           AiEvaluationRepository evaluationRepository,
                           QuestionBankRepository questionRepository,
                           QuestionStore questionStore,
                           CurriculumService curriculumService,
                           GenerationService generationService,
                           ProgressService progressService,
                           StudentRepository studentRepository,
                           SettingsService settingsService,
                           EvaluationService evaluationService,
                           org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.homeworkRepository = homeworkRepository;
        this.homeworkQuestionRepository = homeworkQuestionRepository;
        this.answerRepository = answerRepository;
        this.evaluationRepository = evaluationRepository;
        this.questionRepository = questionRepository;
        this.questionStore = questionStore;
        this.curriculumService = curriculumService;
        this.generationService = generationService;
        this.progressService = progressService;
        this.studentRepository = studentRepository;
        this.settingsService = settingsService;
        this.evaluationService = evaluationService;
        this.eventPublisher = eventPublisher;
    }

    /** Misconception tags collected from the student's evaluated homework. Used by the adaptive engine. */
    @Transactional(readOnly = true)
    public List<StudentMisconception> misconceptionsForStudent(UUID studentId) {
        return answerRepository.findMisconceptions(studentId).stream()
                .map(m -> new StudentMisconception(m.getTopicId(), m.getMisconception()))
                .toList();
    }

    public record StudentMisconception(UUID topicId, String text) {
    }

    @Transactional(readOnly = true)
    public List<HomeworkSummaryDto> listForStudent(UUID studentId) {
        return homeworkRepository.findByStudentIdOrderByCreatedAtDesc(studentId).stream()
                .map(h -> new HomeworkSummaryDto(h.getId(), h.getTopicId(),
                        topicName(h.getTopicId()), h.getStatus(), h.getScore(),
                        h.getDueAt(), h.getCreatedAt()))
                .toList();
    }

    /** Opens homework for a topic, generating a fresh assignment if none exists yet. Gated by progression. */
    @Transactional
    public HomeworkDetailDto openForTopic(AuthPrincipal student, UUID topicId) {
        progressService.assertUnlocked(student.id(), topicId);
        HomeworkAssignment hw = homeworkRepository
                .findFirstByStudentIdAndTopicIdOrderByCreatedAtDesc(student.id(), topicId)
                .orElseGet(() -> createWithQuestions(student.id(), topicId, "SYSTEM"));
        return detail(hw);
    }

    @Transactional(readOnly = true)
    public HomeworkDetailDto getDetail(AuthPrincipal student, UUID homeworkId) {
        return detail(requireOwned(student.id(), homeworkId));
    }

    @Transactional
    public HomeworkResultDto submit(AuthPrincipal student, UUID homeworkId, SubmitHomeworkRequest req) {
        HomeworkAssignment hw = requireOwned(student.id(), homeworkId);
        if (!"ASSIGNED".equals(hw.getStatus())) {
            throw new BadRequestException("This homework has already been submitted");
        }

        // Persist raw responses now; the async evaluator fills in grades/feedback.
        for (SubmittedAnswer a : req.answers()) {
            HomeworkAnswer ans = new HomeworkAnswer();
            ans.setHomeworkId(hw.getId());
            ans.setQuestionId(a.questionId());
            ans.setResponse(a.response());
            answerRepository.save(ans);
        }
        hw.setStatus("EVALUATING");
        hw.setSubmittedAt(Instant.now());
        homeworkRepository.save(hw);

        // Hand off to the async evaluator AFTER this transaction commits, so it sees the
        // saved answers and EVALUATING status (not the pre-commit state).
        UUID hwId = hw.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                evaluationService.evaluateAsync(hwId);
            }
        });

        return result(hw);
    }

    @Transactional(readOnly = true)
    public HomeworkResultDto getResult(AuthPrincipal student, UUID homeworkId) {
        return result(requireOwned(student.id(), homeworkId));
    }

    /** Auto-assigns homework after a quiz, if the parent has it enabled and none exists yet.
     *  Async so it never slows the quiz submission. */
    @Async
    @Transactional
    public void autoAssignAfterQuiz(UUID studentId, UUID topicId) {
        try {
            UUID parentId = studentRepository.findById(studentId)
                    .map(s -> s.getParentId()).orElse(null);
            if (parentId == null) {
                return;
            }
            boolean enabled = settingsService.getBool(SettingsService.PARENT, parentId,
                    SettingsService.KEY_AUTO_ASSIGN_HOMEWORK, true);
            if (!enabled || homeworkRepository.existsByStudentIdAndTopicId(studentId, topicId)) {
                return;
            }
            createWithQuestions(studentId, topicId, "SYSTEM");
            eventPublisher.publishEvent(
                    new com.mathtutor.notification.events.NotificationEvents.HomeworkAssignedEvent(studentId, topicId));
        } catch (Exception e) {
            log.warn("Auto-assign homework failed for student {} topic {}: {}", studentId, topicId, e.getMessage());
        }
    }

    private HomeworkAssignment createWithQuestions(UUID studentId, UUID topicId, String assignedBy) {
        TopicContext ctx = curriculumService.resolveTopicContext(topicId);
        GenerationContext genCtx = new GenerationContext(
                ctx.subjectName(), ctx.gradeName(), ctx.topicName(), ctx.objectives());
        PracticeBatch batch = generationService.generateHomework(genCtx, HOMEWORK_QUESTION_COUNT, studentId);
        if (batch.questions() == null || batch.questions().isEmpty()) {
            throw new AiException("Aria could not create the homework. Please try again.");
        }

        HomeworkAssignment hw = new HomeworkAssignment();
        hw.setStudentId(studentId);
        hw.setTopicId(topicId);
        hw.setAssignedBy(assignedBy);
        hw.setDueAt(Instant.now().plus(3, ChronoUnit.DAYS));
        hw = homeworkRepository.save(hw);

        int order = 0;
        for (GeneratedQuestion gq : batch.questions()) {
            QuestionBank saved = questionStore.persist(topicId, gq, "MEDIUM", "HOMEWORK");
            HomeworkQuestion link = new HomeworkQuestion();
            link.setHomeworkId(hw.getId());
            link.setQuestionId(saved.getId());
            link.setOrdering(order++);
            homeworkQuestionRepository.save(link);
        }
        return hw;
    }

    private HomeworkDetailDto detail(HomeworkAssignment hw) {
        List<HomeworkQuestionDto> questions = homeworkQuestionRepository
                .findByHomeworkIdOrderByOrdering(hw.getId()).stream()
                .map(link -> questionRepository.findById(link.getQuestionId()).orElseThrow())
                .map(q -> new HomeworkQuestionDto(q.getId(), q.getType(),
                        q.getPromptText(), questionStore.readChoices(q.getChoices())))
                .toList();
        return new HomeworkDetailDto(hw.getId(), hw.getTopicId(), topicName(hw.getTopicId()),
                hw.getStatus(), hw.getScore(), questions);
    }

    private HomeworkResultDto result(HomeworkAssignment hw) {
        if (!"EVALUATED".equals(hw.getStatus())) {
            return new HomeworkResultDto(hw.getId(), topicName(hw.getTopicId()), hw.getStatus(),
                    null, null, null, List.of());
        }
        AiEvaluation eval = evaluationRepository.findByHomeworkId(hw.getId()).orElse(null);
        List<AnswerResultDto> results = answerRepository.findByHomeworkId(hw.getId()).stream()
                .map(a -> {
                    QuestionBank q = questionRepository.findById(a.getQuestionId()).orElseThrow();
                    return new AnswerResultDto(a.getQuestionId(), q.getPromptText(), a.getResponse(),
                            a.isCorrect(), a.getPartialCredit(), a.getFeedback(), a.getMisconception(),
                            q.getCorrectAnswer(), q.getSolution());
                })
                .toList();
        return new HomeworkResultDto(hw.getId(), topicName(hw.getTopicId()), hw.getStatus(),
                hw.getScore(), eval == null ? null : eval.getSummary(),
                eval == null ? null : eval.getRecommendations(), results);
    }

    private HomeworkAssignment requireOwned(UUID studentId, UUID homeworkId) {
        HomeworkAssignment hw = homeworkRepository.findById(homeworkId)
                .orElseThrow(() -> new NotFoundException("Homework not found"));
        if (!hw.getStudentId().equals(studentId)) {
            throw new ForbiddenException("This homework does not belong to you");
        }
        return hw;
    }

    private String topicName(UUID topicId) {
        return curriculumService.requireTopic(topicId).getName();
    }
}
