package com.mathtutor.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.ai.content.Advice;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.ai.content.ExamplesContent;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.Hint;
import com.mathtutor.ai.content.KnowledgeContent;
import com.mathtutor.ai.content.PracticeBatch;
import com.mathtutor.ai.content.VerifiedAnswerKeys;
import com.mathtutor.ai.content.VerifiedExamples;
import com.mathtutor.ai.content.WorkedExample;
import com.mathtutor.practice.AnswerMatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * High-level AI generation use cases. Each method resolves a named prompt and
 * returns validated, structured content. Prompt names map to rows in prompt_templates.
 */
@Service
public class GenerationService {

    public static final String PROMPT_KNOWLEDGE = "KNOWLEDGE";
    public static final String PROMPT_ELABORATE = "ELABORATE";
    public static final String PROMPT_PRACTICE = "PRACTICE";
    public static final String PROMPT_EXAMPLES = "EXAMPLES";
    public static final String PROMPT_HINT = "HINT";
    public static final String PROMPT_QUIZ = "QUIZ";
    public static final String PROMPT_HOMEWORK = "HOMEWORK";
    public static final String PROMPT_EVALUATION = "EVALUATION";
    public static final String PROMPT_RECOMMENDATION = "RECOMMENDATION";
    public static final String PROMPT_ANSWER_CHECK = "ANSWER_CHECK";
    public static final String PROMPT_ANSWER_VERIFY = "ANSWER_VERIFY";
    public static final String PROMPT_EXAMPLE_VERIFY = "EXAMPLE_VERIFY";

    private static final Logger log = LoggerFactory.getLogger(GenerationService.class);

    private final AiClient aiClient;
    private final ObjectMapper objectMapper;

    public GenerationService(AiClient aiClient, ObjectMapper objectMapper) {
        this.aiClient = aiClient;
        this.objectMapper = objectMapper;
    }

    public KnowledgeContent generateKnowledge(GenerationContext ctx) {
        Map<String, String> vars = baseVars(ctx);
        return aiClient.generateStructured(PROMPT_KNOWLEDGE, vars, KnowledgeContent.class, null);
    }

    public ExamplesContent generateExamples(GenerationContext ctx) {
        Map<String, String> vars = baseVars(ctx);
        ExamplesContent content = aiClient.generateStructured(PROMPT_EXAMPLES, vars, ExamplesContent.class, null);
        return verifyExamples(content, ctx.subjectName());
    }

    /** Re-teaches a topic in a fresh, simpler way (for the "Explain it differently" action). */
    public KnowledgeContent elaborate(GenerationContext ctx) {
        return aiClient.generateStructured(PROMPT_ELABORATE, baseVars(ctx), KnowledgeContent.class, null);
    }

    public PracticeBatch generatePractice(GenerationContext ctx, String difficulty, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("difficulty", difficulty);
        vars.put("count", String.valueOf(count));
        PracticeBatch batch = aiClient.generateStructured(PROMPT_PRACTICE, vars, PracticeBatch.class, studentId);
        return verifyAnswerKeys(batch, ctx.subjectName(), studentId);
    }

    public PracticeBatch generateQuiz(GenerationContext ctx, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("count", String.valueOf(count));
        PracticeBatch batch = aiClient.generateStructured(PROMPT_QUIZ, vars, PracticeBatch.class, studentId);
        return verifyAnswerKeys(batch, ctx.subjectName(), studentId);
    }

    public PracticeBatch generateHomework(GenerationContext ctx, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("count", String.valueOf(count));
        PracticeBatch batch = aiClient.generateStructured(PROMPT_HOMEWORK, vars, PracticeBatch.class, studentId);
        return verifyAnswerKeys(batch, ctx.subjectName(), studentId);
    }

    /**
     * Re-checks the answer key of every multiple-choice question with a focused, low-temperature
     * solver and corrects any that were mislabeled at generation time. Only ever moves the key to
     * an option the verifier picks that already exists among the choices; if verification fails or
     * returns something unrecognizable, the original key is kept (never made worse).
     */
    PracticeBatch verifyAnswerKeys(PracticeBatch batch, String subjectName, UUID studentId) {
        if (batch == null || batch.questions() == null || batch.questions().isEmpty()) {
            return batch;
        }
        GeneratedQuestion[] result = batch.questions().toArray(new GeneratedQuestion[0]);
        boolean[] drop = new boolean[result.length];      // question is broken — remove it
        boolean[] resolved = new boolean[result.length];   // deterministically settled — skip the model pass

        // ── Pass 1: deterministic math check (authoritative; the model is not trusted for these) ──
        int detFixed = 0, detDropped = 0, detShort = 0;
        for (int i = 0; i < result.length; i++) {
            GeneratedQuestion q = result[i];
            if (q == null) {
                continue;
            }
            if (isMultipleChoice(q) && q.choices() != null && !q.choices().isEmpty()) {
                MathAnswerChecker.Verdict v = MathAnswerChecker.checkMultipleChoice(q.prompt(), q.choices());
                switch (v.outcome()) {
                    case CORRECT -> {
                        resolved[i] = true;
                        if (!AnswerMatcher.matches(v.correctChoice(), q.correctAnswer())) {
                            result[i] = withAnswer(q, v.correctChoice());
                            detFixed++;
                        }
                    }
                    case NO_CORRECT_OPTION -> {
                        drop[i] = true;
                        resolved[i] = true;
                        detDropped++;
                        log.info("Dropping broken MC question (no correct option): {}", q.prompt());
                    }
                    case UNKNOWN -> { /* fall through to the model-based pass */ }
                }
            } else if (isShortAnswer(q)) {
                var computed = MathAnswerChecker.solveNumeric(q.prompt());
                if (computed.isPresent()) {
                    String canonical = computed.get().stripTrailingZeros().toPlainString();
                    if (!numericMatchesKey(canonical, q.correctAnswer())) {
                        result[i] = withAnswer(q, canonical);
                        detShort++;
                    }
                }
            }
        }

        // ── Pass 2: model-based verification for the MC questions Pass 1 could not settle ──
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < result.length; i++) {
            GeneratedQuestion q = result[i];
            if (!drop[i] && !resolved[i] && isMultipleChoice(q) && q.choices() != null && !q.choices().isEmpty()) {
                Map<String, Object> item = new HashMap<>();
                item.put("index", i);
                item.put("question", q.prompt());
                item.put("choices", q.choices());
                items.add(item);
            }
        }
        int modelCorrected = 0;
        if (!items.isEmpty()) {
            try {
                Map<String, String> vars = new HashMap<>();
                vars.put("subject_name", subjectName == null ? "this subject" : subjectName);
                vars.put("questions_json", objectMapper.writeValueAsString(items));
                VerifiedAnswerKeys verified =
                        aiClient.generateStructured(PROMPT_ANSWER_VERIFY, vars, VerifiedAnswerKeys.class, studentId);
                if (verified != null && verified.answers() != null) {
                    for (VerifiedAnswerKeys.VerifiedKey vk : verified.answers()) {
                        int idx = vk.index();
                        if (idx < 0 || idx >= result.length || resolved[idx] || drop[idx]
                                || vk.correctAnswer() == null || vk.correctAnswer().isBlank()) {
                            continue;
                        }
                        GeneratedQuestion q = result[idx];
                        if (!isMultipleChoice(q) || q.choices() == null) {
                            continue;
                        }
                        String match = matchingChoice(q.choices(), vk.correctAnswer());
                        if (match == null || AnswerMatcher.matches(match, q.correctAnswer())) {
                            continue; // not an option, or already agrees — nothing to do
                        }
                        // Corroborate with the question's OWN solution before overwriting. The model is
                        // fallible; only trust it when the solution supports the new answer and NOT the
                        // original — this stops it from clobbering an already-correct key.
                        boolean newBacked = supportedBySolution(match, q.solution());
                        boolean origBacked = supportedBySolution(q.correctAnswer(), q.solution());
                        if (newBacked && !origBacked) {
                            result[idx] = withAnswer(q, match);
                            modelCorrected++;
                        } else {
                            log.info("Skipped answer-key change '{}' -> '{}' (solution backs new={}, original={}).",
                                    q.correctAnswer(), match, newBacked, origBacked);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Model answer-key verification failed; keeping keys from the deterministic pass: {}",
                        e.getMessage());
            }
        }

        if (detFixed + detDropped + detShort + modelCorrected > 0) {
            log.info("Answer-key verification: deterministic fixed {}, dropped {}, short-answer fixed {}; model fixed {}.",
                    detFixed, detDropped, detShort, modelCorrected);
        }

        // ── Remove dropped questions and return ──
        List<GeneratedQuestion> kept = new ArrayList<>();
        for (int i = 0; i < result.length; i++) {
            if (!drop[i] && result[i] != null) {
                kept.add(result[i]);
            }
        }
        return new PracticeBatch(kept);
    }

    private static GeneratedQuestion withAnswer(GeneratedQuestion q, String answer) {
        return new GeneratedQuestion(q.type(), q.difficulty(), q.prompt(), q.choices(), answer, q.solution());
    }

    private static boolean isShortAnswer(GeneratedQuestion q) {
        return q != null && "SHORT_ANSWER".equalsIgnoreCase(q.type());
    }

    /** True when the stored key parses to the same number as the deterministically-computed answer. */
    private static boolean numericMatchesKey(String canonical, String storedKey) {
        return MathAnswerChecker.numericEquals(canonical, storedKey);
    }

    /**
     * Re-solves every worked example with a focused, low-temperature solver and replaces its
     * steps and final answer with the verified solution, so a wrong worked example never reaches
     * a child. On any failure the original content is returned unchanged.
     */
    ExamplesContent verifyExamples(ExamplesContent content, String subjectName) {
        if (content == null || content.examples() == null || content.examples().isEmpty()) {
            return content;
        }
        List<WorkedExample> examples = content.examples();

        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < examples.size(); i++) {
            WorkedExample ex = examples.get(i);
            if (ex == null || ex.problem() == null || ex.problem().isBlank()) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("index", i);
            item.put("problem", ex.problem());
            item.put("steps", ex.steps() == null ? List.of() : ex.steps());
            item.put("answer", ex.answer() == null ? "" : ex.answer());
            items.add(item);
        }
        if (items.isEmpty()) {
            return content;
        }

        VerifiedExamples verified;
        try {
            Map<String, String> vars = new HashMap<>();
            vars.put("subject_name", subjectName == null ? "this subject" : subjectName);
            vars.put("examples_json", objectMapper.writeValueAsString(items));
            verified = aiClient.generateStructured(PROMPT_EXAMPLE_VERIFY, vars, VerifiedExamples.class, null);
        } catch (Exception e) {
            log.warn("Worked-example verification failed; keeping original examples: {}", e.getMessage());
            return content;
        }
        if (verified == null || verified.examples() == null) {
            return content;
        }

        WorkedExample[] result = examples.toArray(new WorkedExample[0]);
        int corrected = 0;
        for (VerifiedExamples.VerifiedExample ve : verified.examples()) {
            int idx = ve.index();
            if (idx < 0 || idx >= result.length || ve.answer() == null || ve.answer().isBlank()) {
                continue;
            }
            WorkedExample original = result[idx];
            List<String> steps = (ve.steps() == null || ve.steps().isEmpty()) ? original.steps() : ve.steps();
            result[idx] = new WorkedExample(original.problem(), steps, ve.answer());
            if (!AnswerMatcher.matches(ve.answer(), original.answer())) {
                corrected++;
            }
        }
        if (corrected > 0) {
            log.info("Worked-example verification corrected {} of {} example answer(s).", corrected, items.size());
        }
        return new ExamplesContent(List.of(result));
    }

    private static boolean isMultipleChoice(GeneratedQuestion q) {
        return q != null && "MULTIPLE_CHOICE".equalsIgnoreCase(q.type());
    }

    /**
     * Whether an answer value is corroborated by the question's solution text. For a numeric
     * answer we compare it against the distinct numbers mentioned in the solution (so "5,000" is
     * NOT considered a match for a solution that says "50,000"); for a text answer we look for it
     * as a phrase. Used to decide whether a verifier-proposed key change is trustworthy.
     */
    private static boolean supportedBySolution(String value, String solution) {
        if (solution == null || solution.isBlank() || value == null) {
            return false;
        }
        String v = stripLabel(value).trim();
        if (v.isEmpty()) {
            return false;
        }
        if (v.matches(".*\\d.*")) {
            String target = v.replaceAll("[,\\s]", "");
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("\\d[\\d,]*(?:\\.\\d+)?").matcher(solution);
            while (m.find()) {
                if (m.group().replaceAll(",", "").equals(target)) {
                    return true;
                }
            }
            return false;
        }
        return solution.toLowerCase().contains(v.toLowerCase());
    }

    /** Finds the choice equal to the verifier's answer, tolerating a missing/extra option label. */
    private static String matchingChoice(List<String> choices, String verified) {
        for (String c : choices) {
            if (AnswerMatcher.matches(c, verified) || AnswerMatcher.matches(stripLabel(c), stripLabel(verified))) {
                return c;
            }
        }
        return null;
    }

    /** Removes a leading option label such as "A)", "B.", "(C)", "d:" so values can be compared. */
    private static String stripLabel(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().replaceFirst("(?i)^\\(?[a-d]\\)?[).:\\-]?\\s+", "").trim();
    }

    /** Fast check of an open short answer: accepts any answer that satisfies the question. */
    public AnswerEvaluation checkShortAnswer(String subjectName, String question, String expected,
                                             String studentAnswer, UUID studentId) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", subjectName);
        vars.put("question", question);
        vars.put("expected", expected == null ? "" : expected);
        vars.put("student_answer", studentAnswer == null ? "" : studentAnswer);
        return aiClient.generateStructured(PROMPT_ANSWER_CHECK, vars, AnswerEvaluation.class, studentId);
    }

    /** Grades one homework answer: correctness, partial credit, feedback, misconception. */
    public AnswerEvaluation evaluateAnswer(String subjectName, String question, String expected,
                                           String solution, String studentAnswer, UUID studentId) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", subjectName);
        vars.put("question", question);
        vars.put("expected", expected == null ? "" : expected);
        vars.put("solution", solution == null ? "" : solution);
        vars.put("student_answer", studentAnswer == null ? "" : studentAnswer);
        return aiClient.generateStructured(PROMPT_EVALUATION, vars, AnswerEvaluation.class, studentId);
    }

    /** Short, friendly study advice from a summary of strengths, weaknesses, and mistakes. */
    public Advice generateAdvice(String subjectName, String strengths, String weaknesses,
                                 String mistakes, UUID studentId) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", subjectName);
        vars.put("strengths", strengths == null || strengths.isBlank() ? "none yet" : strengths);
        vars.put("weaknesses", weaknesses == null || weaknesses.isBlank() ? "none yet" : weaknesses);
        vars.put("mistakes", mistakes == null || mistakes.isBlank() ? "none yet" : mistakes);
        return aiClient.generateStructured(PROMPT_RECOMMENDATION, vars, Advice.class, studentId);
    }

    /** Synchronous, fast-model hint for the guided-practice loop. Never reveals the answer. */
    public Hint generateHint(String subjectName, String question, String studentAnswer, int attempt, UUID studentId) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", subjectName);
        vars.put("question", question);
        vars.put("student_answer", studentAnswer);
        vars.put("attempt", String.valueOf(attempt));
        return aiClient.generateStructured(PROMPT_HINT, vars, Hint.class, studentId);
    }

    private Map<String, String> baseVars(GenerationContext ctx) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", ctx.subjectName());
        vars.put("grade_name", ctx.gradeName());
        vars.put("topic_name", ctx.topicName());
        vars.put("objectives", ctx.objectives() == null ? "" : ctx.objectives());
        vars.put("learner_note", ctx.learnerNote() == null ? "Use clear, age-appropriate explanations." : ctx.learnerNote());
        return vars;
    }
}
