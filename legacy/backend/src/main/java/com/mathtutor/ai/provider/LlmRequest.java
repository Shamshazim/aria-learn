package com.mathtutor.ai.provider;

/**
 * A provider-agnostic LLM request. The application only ever speaks in these terms;
 * adapters translate to whatever the underlying engine expects.
 */
public record LlmRequest(
        String systemPrompt,
        String userPrompt,
        ModelTier tier,
        double temperature,
        int maxTokens,
        boolean jsonMode) {

    public static LlmRequest text(String system, String user, ModelTier tier, double temperature) {
        return new LlmRequest(system, user, tier, temperature, 2048, false);
    }

    public static LlmRequest json(String system, String user, ModelTier tier, double temperature) {
        return new LlmRequest(system, user, tier, temperature, 2048, true);
    }
}
