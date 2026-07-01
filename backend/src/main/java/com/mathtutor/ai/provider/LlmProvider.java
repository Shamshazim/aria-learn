package com.mathtutor.ai.provider;

/**
 * The single port through which the whole application talks to an LLM.
 * Default implementation is self-hosted (Ollama). A cloud implementation can be
 * added later without changing any caller.
 */
public interface LlmProvider {

    LlmResponse complete(LlmRequest request);

    /** Identifies which concrete provider is active (for logging/diagnostics). */
    String name();
}
