package com.mathtutor.ai;

import com.mathtutor.ai.content.Advice;
import com.mathtutor.ai.content.AnswerEvaluation;
import com.mathtutor.ai.content.ExamplesContent;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.ai.content.Hint;
import com.mathtutor.ai.content.KnowledgeContent;
import com.mathtutor.ai.content.PracticeBatch;
import org.springframework.stereotype.Service;

import java.util.HashMap;
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

    private final AiClient aiClient;

    public GenerationService(AiClient aiClient) {
        this.aiClient = aiClient;
    }

    public KnowledgeContent generateKnowledge(GenerationContext ctx) {
        Map<String, String> vars = baseVars(ctx);
        return aiClient.generateStructured(PROMPT_KNOWLEDGE, vars, KnowledgeContent.class, null);
    }

    public ExamplesContent generateExamples(GenerationContext ctx) {
        Map<String, String> vars = baseVars(ctx);
        return aiClient.generateStructured(PROMPT_EXAMPLES, vars, ExamplesContent.class, null);
    }

    /** Re-teaches a topic in a fresh, simpler way (for the "Explain it differently" action). */
    public KnowledgeContent elaborate(GenerationContext ctx) {
        return aiClient.generateStructured(PROMPT_ELABORATE, baseVars(ctx), KnowledgeContent.class, null);
    }

    public PracticeBatch generatePractice(GenerationContext ctx, String difficulty, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("difficulty", difficulty);
        vars.put("count", String.valueOf(count));
        return aiClient.generateStructured(PROMPT_PRACTICE, vars, PracticeBatch.class, studentId);
    }

    public PracticeBatch generateQuiz(GenerationContext ctx, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("count", String.valueOf(count));
        return aiClient.generateStructured(PROMPT_QUIZ, vars, PracticeBatch.class, studentId);
    }

    public PracticeBatch generateHomework(GenerationContext ctx, int count, UUID studentId) {
        Map<String, String> vars = baseVars(ctx);
        vars.put("count", String.valueOf(count));
        return aiClient.generateStructured(PROMPT_HOMEWORK, vars, PracticeBatch.class, studentId);
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
