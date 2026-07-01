package com.mathtutor.practice;

import com.mathtutor.ai.GenerationContext;
import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.PracticeBatch;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.practice.dto.PracticeDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class PracticeService {

    private static final List<String> ALLOWED_DIFFICULTIES =
            List.of("EASY", "MEDIUM", "HARD", "CHALLENGE", "OLYMPIAD");

    private final QuestionBankRepository questionRepository;
    private final CurriculumService curriculumService;
    private final GenerationService generationService;
    private final QuestionStore questionStore;
    private final com.mathtutor.progress.ProgressService progressService;
    private final com.mathtutor.mastery.MasteryService masteryService;
    private final com.mathtutor.gamification.GamificationService gamificationService;
    private final AnswerGrader answerGrader;

    public PracticeService(QuestionBankRepository questionRepository,
                           CurriculumService curriculumService,
                           GenerationService generationService,
                           QuestionStore questionStore,
                           com.mathtutor.progress.ProgressService progressService,
                           com.mathtutor.mastery.MasteryService masteryService,
                           com.mathtutor.gamification.GamificationService gamificationService,
                           AnswerGrader answerGrader) {
        this.questionRepository = questionRepository;
        this.curriculumService = curriculumService;
        this.generationService = generationService;
        this.questionStore = questionStore;
        this.progressService = progressService;
        this.masteryService = masteryService;
        this.gamificationService = gamificationService;
        this.answerGrader = answerGrader;
    }

    @Transactional
    public PracticeSetDto generateIndependent(AuthPrincipal student, GeneratePracticeRequest req) {
        progressService.assertUnlocked(student.id(), req.topicId());
        String difficulty = resolveDifficulty(student.id(), req.topicId(), req.difficulty());
        int count = req.count() == null ? 5 : req.count();

        TopicContext ctx = curriculumService.resolveTopicContext(req.topicId());
        GenerationContext genCtx = new GenerationContext(
                ctx.subjectName(), ctx.gradeName(), ctx.topicName(), ctx.objectives());

        PracticeBatch batch = generationService.generatePractice(genCtx, difficulty, count, student.id());

        List<PracticeQuestionDto> questions = new ArrayList<>();
        for (GeneratedQuestion gq : batch.questions()) {
            QuestionBank saved = questionStore.persist(req.topicId(), gq, difficulty, "GENERATED");
            questions.add(new PracticeQuestionDto(
                    saved.getId(),
                    saved.getType(),
                    saved.getDifficulty(),
                    saved.getPromptText(),
                    questionStore.readChoices(saved.getChoices())));
        }
        return new PracticeSetDto(req.topicId(), difficulty, questions);
    }

    @Transactional
    public AnswerResult checkAnswer(AuthPrincipal student, AnswerRequest req) {
        QuestionBank q = questionRepository.findById(req.questionId())
                .orElseThrow(() -> new NotFoundException("Question not found"));
        AnswerGrader.GradeResult g = answerGrader.grade(q, req.response(), student.id());
        masteryService.recordPracticeResult(student.id(), q.getTopicId(), g.correct());
        gamificationService.onPracticeAnswered(student.id(), g.correct());
        return new AnswerResult(g.correct(), q.getCorrectAnswer(), q.getSolution(), g.feedback());
    }

    /** Resolves the requested difficulty; "AUTO" (or blank) adapts to the student's recent accuracy. */
    private String resolveDifficulty(java.util.UUID studentId, java.util.UUID topicId, String requested) {
        if (requested != null && !requested.isBlank() && !"AUTO".equalsIgnoreCase(requested.trim())) {
            String upper = requested.trim().toUpperCase();
            return ALLOWED_DIFFICULTIES.contains(upper) ? upper : "EASY";
        }
        var record = masteryService.getOrEmpty(studentId, topicId);
        Integer practiceAccuracy = (record != null && record.getPracticeTotal() > 0)
                ? Math.round(record.getPracticeCorrect() * 100f / record.getPracticeTotal())
                : null;
        return com.mathtutor.adaptive.AdaptiveRules.suggestDifficulty(practiceAccuracy);
    }
}
