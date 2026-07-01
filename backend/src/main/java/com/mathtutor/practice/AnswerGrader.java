package com.mathtutor.practice;

import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.curriculum.CurriculumService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Grades a single answer. Multiple-choice is graded instantly by exact match. Short
 * answers are first checked for an exact match (fast path); if they do not match the
 * stored example, the AI judges whether the answer still satisfies the question — so
 * the many valid answers to an open question ("write a sentence...") are accepted.
 * Shared by practice and quizzes.
 */
@Service
public class AnswerGrader {

    private static final Logger log = LoggerFactory.getLogger(AnswerGrader.class);

    private final GenerationService generationService;
    private final CurriculumService curriculumService;

    public AnswerGrader(GenerationService generationService, CurriculumService curriculumService) {
        this.generationService = generationService;
        this.curriculumService = curriculumService;
    }

    public record GradeResult(boolean correct, String feedback) {
    }

    public GradeResult grade(QuestionBank q, String response, UUID studentId) {
        boolean exact = AnswerMatcher.matches(response, q.getCorrectAnswer());

        // Multiple choice: a single option is correct — exact match is definitive.
        if ("MULTIPLE_CHOICE".equalsIgnoreCase(q.getType())) {
            return new GradeResult(exact, q.getSolution());
        }
        // Short answer that exactly matches the expected value is correct, no AI needed.
        if (exact) {
            return new GradeResult(true, q.getSolution());
        }
        // Otherwise let the AI decide whether the answer satisfies the question.
        try {
            String subject = curriculumService.resolveTopicContext(q.getTopicId()).subjectName();
            AnswerEvaluation e = generationService.checkShortAnswer(
                    subject, q.getPromptText(), q.getCorrectAnswer(), response, studentId);
            String feedback = (e.feedback() != null && !e.feedback().isBlank()) ? e.feedback() : q.getSolution();
            return new GradeResult(e.correct(), feedback);
        } catch (Exception ex) {
            log.warn("AI answer check failed, falling back to exact match: {}", ex.getMessage());
            return new GradeResult(false, q.getSolution());
        }
    }
}
