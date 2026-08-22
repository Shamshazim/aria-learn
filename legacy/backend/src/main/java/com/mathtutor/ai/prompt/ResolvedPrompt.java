package com.mathtutor.ai.prompt;

import com.mathtutor.ai.provider.ModelTier;

public record ResolvedPrompt(
        String name,
        int version,
        String systemPrompt,
        String userPrompt,
        ModelTier tier,
        double temperature,
        int maxTokens,
        boolean jsonMode) {
}
