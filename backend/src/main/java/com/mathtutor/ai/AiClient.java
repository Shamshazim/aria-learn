package com.mathtutor.ai;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.ai.log.AiGenerationLog;
import com.mathtutor.ai.log.AiGenerationLogRepository;
import com.mathtutor.ai.prompt.PromptRegistry;
import com.mathtutor.ai.prompt.ResolvedPrompt;
import com.mathtutor.ai.provider.LlmProvider;
import com.mathtutor.ai.provider.LlmRequest;
import com.mathtutor.ai.provider.LlmResponse;
import com.mathtutor.common.AiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Orchestrates an AI generation: resolve a named prompt, call the provider,
 * parse structured JSON output, repair once on failure, and log the call.
 * This is the single entry point business services use for AI work.
 */
@Service
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private final PromptRegistry promptRegistry;
    private final LlmProvider provider;
    private final ObjectMapper objectMapper;
    private final AiGenerationLogRepository logRepository;

    public AiClient(PromptRegistry promptRegistry,
                    LlmProvider provider,
                    ObjectMapper objectMapper,
                    AiGenerationLogRepository logRepository) {
        this.promptRegistry = promptRegistry;
        this.provider = provider;
        this.objectMapper = objectMapper;
        this.logRepository = logRepository;
    }

    public <T> T generateStructured(String promptName, Map<String, String> vars,
                                    Class<T> type, UUID studentId) {
        JavaType javaType = objectMapper.getTypeFactory().constructType(type);
        return generate(promptName, vars, javaType, studentId, false);
    }

    public <T> T generateStructured(String promptName, Map<String, String> vars,
                                    JavaType javaType, UUID studentId) {
        return generate(promptName, vars, javaType, studentId, false);
    }

    public String generateText(String promptName, Map<String, String> vars, UUID studentId) {
        ResolvedPrompt prompt = promptRegistry.resolve(promptName, vars);
        LlmResponse response = call(prompt.systemPrompt(), prompt.userPrompt(), prompt, false);
        persistLog(prompt, response, studentId, 0, true);
        return response.content();
    }

    /** Runs a prompt against the live model and returns the RAW output (no schema parsing).
     *  Logged with is_test=true so it does not pollute production usage stats. */
    public TestResult runTest(String promptName, Map<String, String> vars) {
        ResolvedPrompt prompt = promptRegistry.resolve(promptName, vars);
        LlmResponse response = call(prompt.systemPrompt(), prompt.userPrompt(), prompt, prompt.jsonMode());
        persistTestLog(prompt, response);
        return new TestResult(response.content(), response.model(),
                response.promptTokens(), response.completionTokens(), response.latencyMs());
    }

    public record TestResult(String output, String model, int promptTokens, int completionTokens, long latencyMs) {
    }

    private <T> T generate(String promptName, Map<String, String> vars,
                           JavaType javaType, UUID studentId, boolean isTest) {
        ResolvedPrompt prompt = promptRegistry.resolve(promptName, vars);

        LlmResponse response = call(prompt.systemPrompt(), prompt.userPrompt(), prompt, true);
        String json = extractJson(response.content());
        try {
            T result = objectMapper.readValue(json, javaType);
            persistLog(prompt, response, studentId, 0, true);
            return result;
        } catch (Exception firstError) {
            log.warn("AI output for '{}' failed to parse, attempting one repair: {}",
                    promptName, firstError.getMessage());
            // Repair attempt: feed the bad output and the error back, demand corrected JSON.
            String repairUser = "Your previous response was not valid JSON matching the required schema.\n"
                    + "Error: " + firstError.getMessage() + "\n\n"
                    + "Previous response:\n" + response.content() + "\n\n"
                    + "Return ONLY corrected, valid JSON. No prose, no markdown fences.";
            LlmResponse repair = call(prompt.systemPrompt(), repairUser, prompt, true);
            String repairedJson = extractJson(repair.content());
            try {
                T result = objectMapper.readValue(repairedJson, javaType);
                persistLog(prompt, repair, studentId, 1, true);
                return result;
            } catch (Exception secondError) {
                persistLog(prompt, repair, studentId, 1, false);
                throw new AiException("AI produced invalid structured output after one repair: "
                        + secondError.getMessage());
            }
        }
    }

    private LlmResponse call(String system, String user, ResolvedPrompt prompt, boolean jsonMode) {
        LlmRequest request = new LlmRequest(system, user, prompt.tier(),
                prompt.temperature(), prompt.maxTokens(), jsonMode && prompt.jsonMode());
        return provider.complete(request);
    }

    private void persistLog(ResolvedPrompt prompt, LlmResponse response, UUID studentId,
                            int repairAttempts, boolean success) {
        try {
            AiGenerationLog entry = new AiGenerationLog();
            entry.setPromptName(prompt.name());
            entry.setPromptVersion(prompt.version());
            entry.setModel(response.model());
            entry.setStudentId(studentId);
            entry.setTokensIn(response.promptTokens());
            entry.setTokensOut(response.completionTokens());
            entry.setLatencyMs(response.latencyMs());
            entry.setRepairAttempts(repairAttempts);
            entry.setSuccess(success);
            entry.setTest(false);
            logRepository.save(entry);
        } catch (Exception e) {
            log.warn("Failed to persist AI generation log: {}", e.getMessage());
        }
    }

    private void persistTestLog(ResolvedPrompt prompt, LlmResponse response) {
        try {
            AiGenerationLog entry = new AiGenerationLog();
            entry.setPromptName(prompt.name());
            entry.setPromptVersion(prompt.version());
            entry.setModel(response.model());
            entry.setTokensIn(response.promptTokens());
            entry.setTokensOut(response.completionTokens());
            entry.setLatencyMs(response.latencyMs());
            entry.setSuccess(true);
            entry.setTest(true);
            logRepository.save(entry);
        } catch (Exception e) {
            log.warn("Failed to persist AI test log: {}", e.getMessage());
        }
    }

    /** Strips markdown fences and isolates the JSON object/array if the model wrapped it. */
    static String extractJson(String content) {
        if (content == null) {
            throw new AiException("AI returned empty content");
        }
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
            trimmed = trimmed.trim();
        }
        int objStart = trimmed.indexOf('{');
        int arrStart = trimmed.indexOf('[');
        int start = (arrStart >= 0 && (objStart < 0 || arrStart < objStart)) ? arrStart : objStart;
        if (start < 0) {
            return trimmed;
        }
        char open = trimmed.charAt(start);
        char close = open == '{' ? '}' : ']';
        int end = trimmed.lastIndexOf(close);
        if (end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed.substring(start);
    }
}
