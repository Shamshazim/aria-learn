package com.mathtutor.quiz;

import com.mathtutor.ai.GenerationContext;
import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.PracticeBatch;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.AiException;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.practice.QuestionBank;
import com.mathtutor.practice.QuestionBankRepository;
import com.mathtutor.practice.QuestionStore;
import com.mathtutor.practice.AnswerMatcher;
import com.mathtutor.quiz.dto.QuizDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class QuizService {

    // M3 defaults; these become configurable via mastery_config in M4.
    private static final int DEFAULT_QUESTION_COUNT = 5;
    private static final int DEFAULT_TIME_LIMIT_SEC = 300;
    private static final int DEFAULT_PASSING_PCT = 80;

    private final QuizRepository quizRepository;
    private final QuizQuestionRepository quizQuestionRepository;
    private final AttemptRepository attemptRepository;
    private final StudentAnswerRepository studentAnswerRepository;
    private final QuestionBankRepository questionRepository;
    private final QuestionStore questionStore;
    private final CurriculumService curriculumService;
    private final GenerationService generationService;
    private final com.mathtutor.progress.ProgressService progressService;
    private final com.mathtutor.mastery.MasteryService masteryService;
    private final com.mathtutor.homework.HomeworkService homeworkService;
    private final com.mathtutor.gamification.GamificationService gamificationService;
    private final com.mathtutor.practice.AnswerGrader answerGrader;

    public QuizService(QuizRepository quizRepository,
                       QuizQuestionRepository quizQuestionRepository,
                       AttemptRepository attemptRepository,
                       StudentAnswerRepository studentAnswerRepository,
                       QuestionBankRepository questionRepository,
                       QuestionStore questionStore,
                       CurriculumService curriculumService,
                       GenerationService generationService,
                       com.mathtutor.progress.ProgressService progressService,
                       com.mathtutor.mastery.MasteryService masteryService,
                       com.mathtutor.homework.HomeworkService homeworkService,
                       com.mathtutor.gamification.GamificationService gamificationService,
                       com.mathtutor.practice.AnswerGrader answerGrader) {
        this.quizRepository = quizRepository;
        this.quizQuestionRepository = quizQuestionRepository;
        this.attemptRepository = attemptRepository;
        this.studentAnswerRepository = studentAnswerRepository;
        this.questionRepository = questionRepository;
        this.questionStore = questionStore;
        this.curriculumService = curriculumService;
        this.generationService = generationService;
        this.progressService = progressService;
        this.masteryService = masteryService;
        this.homeworkService = homeworkService;
        this.gamificationService = gamificationService;
        this.answerGrader = answerGrader;
    }

    @Transactional
    public QuizDto start(AuthPrincipal student, UUID topicId) {
        progressService.assertUnlocked(student.id(), topicId);
        TopicContext ctx = curriculumService.resolveTopicContext(topicId);
        GenerationContext genCtx = new GenerationContext(
                ctx.subjectName(), ctx.gradeName(), ctx.topicName(), ctx.objectives());

        PracticeBatch batch = generationService.generateQuiz(genCtx, DEFAULT_QUESTION_COUNT, student.id());
        if (batch.questions() == null || batch.questions().isEmpty()) {
            throw new AiException("Aria could not create the quiz. Please try again.");
        }

        Quiz quiz = new Quiz();
        quiz.setTopicId(topicId);
        quiz.setStudentId(student.id());
        quiz.setQuestionCount(batch.questions().size());
        quiz.setTimeLimitSec(DEFAULT_TIME_LIMIT_SEC);
        quiz.setPassingPct(DEFAULT_PASSING_PCT);
        quiz = quizRepository.save(quiz);

        List<QuizQuestionDto> dtos = new ArrayList<>();
        int order = 0;
        for (GeneratedQuestion gq : batch.questions()) {
            QuestionBank saved = questionStore.persist(topicId, gq, "MEDIUM", "QUIZ");
            QuizQuestion link = new QuizQuestion();
            link.setQuizId(quiz.getId());
            link.setQuestionId(saved.getId());
            link.setOrdering(order++);
            quizQuestionRepository.save(link);
            dtos.add(new QuizQuestionDto(saved.getId(), saved.getType(),
                    saved.getPromptText(), questionStore.readChoices(saved.getChoices())));
        }

        Attempt attempt = new Attempt();
        attempt.setStudentId(student.id());
        attempt.setActivityType("QUIZ");
        attempt.setActivityId(quiz.getId());
        attempt = attemptRepository.save(attempt);

        return new QuizDto(quiz.getId(), attempt.getId(), quiz.getTimeLimitSec(), quiz.getPassingPct(), dtos);
    }

    @Transactional
    public QuizResult submit(AuthPrincipal student, SubmitQuizRequest req) {
        Attempt attempt = attemptRepository.findById(req.attemptId())
                .orElseThrow(() -> new NotFoundException("Attempt not found"));
        if (!attempt.getStudentId().equals(student.id())) {
            throw new ForbiddenException("This attempt does not belong to you");
        }
        if (!"IN_PROGRESS".equals(attempt.getStatus())) {
            throw new BadRequestException("This quiz has already been submitted");
        }

        Quiz quiz = quizRepository.findById(attempt.getActivityId())
                .orElseThrow(() -> new NotFoundException("Quiz not found"));
        List<QuizQuestion> links = quizQuestionRepository.findByQuizIdOrderByOrdering(quiz.getId());

        Map<UUID, String> responses = new HashMap<>();
        for (SubmittedAnswer a : req.answers()) {
            responses.put(a.questionId(), a.response());
        }

        List<QuestionResult> results = new ArrayList<>();
        int correctCount = 0;
        for (QuizQuestion link : links) {
            QuestionBank q = questionRepository.findById(link.getQuestionId())
                    .orElseThrow(() -> new NotFoundException("Question not found"));
            String response = responses.get(q.getId());
            com.mathtutor.practice.AnswerGrader.GradeResult g = answerGrader.grade(q, response, student.id());
            boolean correct = g.correct();
            if (correct) {
                correctCount++;
            }

            StudentAnswer sa = new StudentAnswer();
            sa.setAttemptId(attempt.getId());
            sa.setQuestionId(q.getId());
            sa.setResponse(response);
            sa.setCorrect(correct);
            studentAnswerRepository.save(sa);

            results.add(new QuestionResult(q.getId(), q.getPromptText(), response,
                    correct, q.getCorrectAnswer(), q.getSolution(), g.feedback()));
        }

        int total = links.size();
        int scorePct = total == 0 ? 0 : Math.round(correctCount * 100f / total);
        boolean passed = scorePct >= quiz.getPassingPct();

        attempt.setStatus("SUBMITTED");
        attempt.setScorePct(scorePct);
        attempt.setPassed(passed);
        attempt.setSubmittedAt(Instant.now());
        attemptRepository.save(attempt);

        // Feed the quiz result into the mastery engine for this topic.
        masteryService.recordQuizScore(student.id(), quiz.getTopicId(), scorePct);

        // Auto-assign homework for this topic (async; respects the parent's setting).
        homeworkService.autoAssignAfterQuiz(student.id(), quiz.getTopicId());

        // Award XP, update goals/streak, and check achievements.
        gamificationService.onQuizCompleted(student.id(), scorePct, passed);

        return new QuizResult(scorePct, passed, correctCount, total, results);
    }
}
