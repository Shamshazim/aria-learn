package com.mathtutor.practice;

import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.QuestionSanitizer;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.curriculum.CurriculumService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Grades a single answer. Multiple-choice is graded instantly by comparing the chosen option with
 * the stored key, tolerating cosmetic differences between them (a label prefix, a differently
 * written number). Short answers are first checked for an exact or numeric match (fast path); if
 * they do not match the stored example, the AI judges whether the answer still satisfies the
 * question — so the many valid answers to an open question ("write a sentence...") are accepted.
 * Shared by practice and quizzes.
 */
@Service
public class AnswerGrader {

    private static final Logger log = LoggerFactory.getLogger(AnswerGrader.class);

    private final GenerationService generationService;
    private final CurriculumService curriculumService;
    private final QuestionStore questionStore;

    public AnswerGrader(GenerationService generationService, CurriculumService curriculumService,
                        QuestionStore questionStore) {
        this.generationService = generationService;
        this.curriculumService = curriculumService;
        this.questionStore = questionStore;
    }

    /**
     * @param correctAnswer the answer to show the child — the exact option text where the stored
     *                      key could be resolved to one, so the right choice is highlighted.
     */
    public record GradeResult(boolean correct, String feedback, String correctAnswer) {
    }

    public GradeResult grade(QuestionBank q, String response, UUID studentId) {
        // Multiple choice: exactly one option is correct, so the comparison is definitive.
        if ("MULTIPLE_CHOICE".equalsIgnoreCase(q.getType())) {
            String key = resolveKey(q);
            return new GradeResult(AnswerMatcher.matchesChoice(response, key), q.getSolution(), key);
        }
        String key = q.getCorrectAnswer();
        // Short answer that exactly matches the expected value is correct, no AI needed.
        if (AnswerMatcher.matches(response, key)) {
            return new GradeResult(true, q.getSolution(), key);
        }
        // Numerically-equivalent answers are correct without asking the AI (0.5 == 0.50, 1,000 == 1000).
        if (com.mathtutor.ai.MathAnswerChecker.numericEquals(response, key)) {
            return new GradeResult(true, q.getSolution(), key);
        }
        // Otherwise let the AI decide whether the answer satisfies the question.
        try {
            String subject = curriculumService.resolveTopicContext(q.getTopicId()).subjectName();
            AnswerEvaluation e = generationService.checkShortAnswer(
                    subject, q.getPromptText(), key, response, studentId);
            String feedback = (e.feedback() != null && !e.feedback().isBlank()) ? e.feedback() : q.getSolution();
            return new GradeResult(e.correct(), feedback, key);
        } catch (Exception ex) {
            log.warn("AI answer check failed, falling back to exact match: {}", ex.getMessage());
            return new GradeResult(false, q.getSolution(), key);
        }
    }

    /**
     * The stored key rewritten as the exact option text it names. Questions generated before the
     * sanitizer existed can hold a key that no option literally equals — a bare letter, or the
     * value without its label — which plain text comparison marks wrong however the child
     * answered. Where the key names no option at all, it is returned unchanged.
     */
    public String resolveKey(QuestionBank q) {
        List<String> options = questionStore.readChoices(q.getChoices());
        String resolved = QuestionSanitizer.resolveKeyToOption(q.getCorrectAnswer(), options);
        if (resolved == null) {
            log.warn("Answer key '{}' matches none of the options for question {} — grading it as stored.",
                    q.getCorrectAnswer(), q.getId());
            return q.getCorrectAnswer();
        }
        return resolved;
    }
}
