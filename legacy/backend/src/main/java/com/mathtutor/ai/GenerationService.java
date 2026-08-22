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
    private final com.mathtutor.tutor.TutorModeService tutorModeService;

    public GenerationService(AiClient aiClient, ObjectMapper objectMapper,
                             com.mathtutor.tutor.TutorModeService tutorModeService) {
        this.aiClient = aiClient;
        this.objectMapper = objectMapper;
        this.tutorModeService = tutorModeService;
    }

    /** The child's tutor-personality instructions, appended to the system prompt of student-facing calls. */
    private String style(UUID studentId) {
        return tutorModeService.styleForStudent(studentId);
    }

    public KnowledgeContent generateKnowledge(GenerationContext ctx, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        return aiClient.generateStructured(PROMPT_KNOWLEDGE, vars, KnowledgeContent.class, studentId, style(studentId));
    }

    public ExamplesContent generateExamples(GenerationContext ctx, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        ExamplesContent content = aiClient.generateStructured(PROMPT_EXAMPLES, vars, ExamplesContent.class, studentId, style(studentId));
        return verifyExamples(content, ctx.subjectName());
    }

    /** Re-teaches a topic in a fresh, simpler way (for the "Explain it differently" action). */
    public KnowledgeContent elaborate(GenerationContext ctx, UUID studentId) {
        return aiClient.generateStructured(PROMPT_ELABORATE, baseVars(ctx), KnowledgeContent.class, studentId, style(studentId));
    }

    public PracticeBatch generatePractice(GenerationContext ctx, String difficulty, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("difficulty", difficulty);
        return generateQuestions(PROMPT_PRACTICE, vars, ctx.subjectName(), count, studentId);
    }

    public PracticeBatch generateQuiz(GenerationContext ctx, int count, UUID studentId) {
        return generateQuestions(PROMPT_QUIZ, baseVars(ctx), ctx.subjectName(), count, studentId);
    }

    public PracticeBatch generateHomework(GenerationContext ctx, int count, UUID studentId) {
        return generateQuestions(PROMPT_HOMEWORK, baseVars(ctx), ctx.subjectName(), count, studentId);
    }

    /**
     * Generates a batch of questions and returns only those that survive verification. Because
     * verification drops broken items, a first pass can come back short; when it does we generate
     * once more to top the set back up rather than hand the child a three-question "quiz". A
     * short set is still returned if the top-up also falls short — fewer good questions beats
     * padding the set with ones that cannot be answered correctly.
     */
    private PracticeBatch generateQuestions(String promptName, Map<String, String> vars,
                                            String subjectName, int count, UUID studentId) {
        vars.put("count", String.valueOf(count));
        List<GeneratedQuestion> kept = new ArrayList<>(askAndVerify(promptName, vars, subjectName, studentId));

        if (kept.size() < count) {
            int missing = count - kept.size();
            log.info("{} returned {} usable question(s) of {}; generating {} more.",
                    promptName, kept.size(), count, missing);
            try {
                Map<String, String> topUpVars = new HashMap<>(vars);
                topUpVars.put("count", String.valueOf(missing));
                for (GeneratedQuestion q : askAndVerify(promptName, topUpVars, subjectName, studentId)) {
                    if (kept.size() >= count) {
                        break;
                    }
                    if (!isDuplicatePrompt(kept, q)) {
                        kept.add(q);
                    }
                }
            } catch (Exception e) {
                log.warn("Top-up generation for {} failed; returning {} question(s): {}",
                        promptName, kept.size(), e.getMessage());
            }
        }
        return new PracticeBatch(kept);
    }

    private List<GeneratedQuestion> askAndVerify(String promptName, Map<String, String> vars,
                                                 String subjectName, UUID studentId) {
        PracticeBatch batch =
                aiClient.generateStructured(promptName, vars, PracticeBatch.class, studentId, style(studentId));
        PracticeBatch verified = verifyAnswerKeys(batch, subjectName, studentId);
        return (verified == null || verified.questions() == null) ? List.of() : verified.questions();
    }

    /** Guards against the top-up handing the child the same question twice. */
    private static boolean isDuplicatePrompt(List<GeneratedQuestion> kept, GeneratedQuestion candidate) {
        for (GeneratedQuestion q : kept) {
            if (AnswerMatcher.matches(q.prompt(), candidate.prompt())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Makes a generated batch safe to show a child, in three passes:
     *
     * <ol>
     *   <li>{@link QuestionSanitizer} repairs structural defects (run-together options, keys that
     *       differ from their option only by a label, leaked "(Correct)" markers) and rejects
     *       items that remain unanswerable — the defect class that marks a child wrong whatever
     *       they click, and that no amount of prompt tuning has eliminated;</li>
     *   <li>a deterministic solver settles the question families it can compute with certainty,
     *       correcting the key or dropping the question when no option holds the real answer;</li>
     *   <li>a focused, low-temperature model pass re-checks whatever is left.</li>
     * </ol>
     *
     * The key only ever moves to an option that already exists, so a question can be fixed or
     * dropped but never given a wrong answer it did not already have.
     */
    PracticeBatch verifyAnswerKeys(PracticeBatch batch, String subjectName, UUID studentId) {
        if (batch == null || batch.questions() == null || batch.questions().isEmpty()) {
            return batch;
        }
        GeneratedQuestion[] result = batch.questions().toArray(new GeneratedQuestion[0]);
        boolean[] drop = new boolean[result.length];      // question is broken — remove it
        boolean[] resolved = new boolean[result.length];   // deterministically settled — skip the model pass

        // ── Pass 0: structural repair and validation (deterministic, no model involved) ──
        int rejected = 0;
        for (int i = 0; i < result.length; i++) {
            QuestionSanitizer.Result sanitized = QuestionSanitizer.sanitize(result[i]);
            if (sanitized.rejected()) {
                drop[i] = true;
                resolved[i] = true;
                rejected++;
                log.info("Dropping unanswerable question ({}): {}", sanitized.rejection(),
                        result[i] == null ? "<null>" : result[i].prompt());
            } else {
                result[i] = sanitized.question();
            }
        }

        // ── Pass 1: deterministic math check (authoritative; the model is not trusted for these) ──
        int detFixed = 0, detDropped = 0, detShort = 0;
        for (int i = 0; i < result.length; i++) {
            GeneratedQuestion q = result[i];
            if (q == null || drop[i]) {
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

        if (rejected + detFixed + detDropped + detShort + modelCorrected > 0) {
            log.info("Question verification of {}: structurally rejected {}; deterministic fixed {}, dropped {}, "
                            + "short-answer fixed {}; model fixed {}.",
                    result.length, rejected, detFixed, detDropped, detShort, modelCorrected);
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
        return aiClient.generateStructured(PROMPT_ANSWER_CHECK, vars, AnswerEvaluation.class, studentId, style(studentId));
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
        return aiClient.generateStructured(PROMPT_EVALUATION, vars, AnswerEvaluation.class, studentId, style(studentId));
    }

    /** Short, friendly study advice from a summary of strengths, weaknesses, and mistakes. */
    public Advice generateAdvice(String subjectName, String strengths, String weaknesses,
                                 String mistakes, UUID studentId) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", subjectName);
        vars.put("strengths", strengths == null || strengths.isBlank() ? "none yet" : strengths);
        vars.put("weaknesses", weaknesses == null || weaknesses.isBlank() ? "none yet" : weaknesses);
        vars.put("mistakes", mistakes == null || mistakes.isBlank() ? "none yet" : mistakes);
        return aiClient.generateStructured(PROMPT_RECOMMENDATION, vars, Advice.class, studentId, style(studentId));
    }

    /** Synchronous, fast-model hint for the guided-practice loop. Never reveals the answer. */
    public Hint generateHint(String subjectName, String question, String studentAnswer, int attempt, UUID studentId) {
        Map<String, String> vars = new HashMap<>();
        vars.put("subject_name", subjectName);
        vars.put("question", question);
        vars.put("student_answer", studentAnswer);
        vars.put("attempt", String.valueOf(attempt));
        Hint hint = aiClient.generateStructured(PROMPT_HINT, vars, Hint.class, studentId, style(studentId));
        // The hint skips sanitize() because it is not a question, but it lands on the same screen
        // and the model marks it up the same way — "<br>" and all. Strip it here or the child
        // reads the tags.
        return hint == null ? null : new Hint(QuestionSanitizer.plainText(hint.hint()));
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
