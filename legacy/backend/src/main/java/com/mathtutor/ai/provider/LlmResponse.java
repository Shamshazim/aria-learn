package com.mathtutor.ai.provider;

public record LlmResponse(
        String content,
        String model,
        int promptTokens,
        int completionTokens,
        long latencyMs) {
}
