package com.mathtutor.ai.provider;

import com.mathtutor.common.AiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Self-hosted LLM provider backed by a local Ollama server.
 * Active by default (app.ai.provider=ollama).
 */
@Component
@ConditionalOnProperty(name = "app.ai.provider", havingValue = "ollama", matchIfMissing = true)
public class OllamaLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaLlmProvider.class);

    private final OllamaProperties props;
    private final RestClient restClient;
    private final boolean desktop;

    public OllamaLlmProvider(OllamaProperties props, org.springframework.core.env.Environment environment) {
        this.props = props;
        this.desktop = environment.acceptsProfiles(
                org.springframework.core.env.Profiles.of("desktop"));
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(props.getTimeoutSeconds()));
        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(factory)
                .build();
    }

    @Override
    public LlmResponse complete(LlmRequest request) {
        String model = props.modelFor(request.tier());
        Map<String, Object> body = Map.of(
                "model", model,
                "stream", false,
                "format", request.jsonMode() ? "json" : "",
                "messages", List.of(
                        Map.of("role", "system", "content", request.systemPrompt()),
                        Map.of("role", "user", "content", request.userPrompt())),
                "options", Map.of(
                        "temperature", request.temperature(),
                        "num_predict", request.maxTokens()));

        long start = System.currentTimeMillis();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/api/chat")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            long latency = System.currentTimeMillis() - start;

            if (response == null) {
                throw new AiException("Empty response from Ollama");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) response.get("message");
            if (message == null || message.get("content") == null) {
                throw new AiException("Ollama response missing message content");
            }
            String content = message.get("content").toString();
            int promptTokens = asInt(response.get("prompt_eval_count"));
            int completionTokens = asInt(response.get("eval_count"));
            return new LlmResponse(content, model, promptTokens, completionTokens, latency);
        } catch (AiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Ollama call failed: {}", e.getMessage());
            throw new AiException(unavailableMessage(model), e);
        }
    }

    /**
     * What to tell whoever is looking at the screen. This message reaches the child directly, so
     * on the desktop app it must not name Ollama or a model file: the engine is bundled, a parent
     * cannot install or start it, and the app restarts it on its own. In development the operator
     * is the developer, who can act on the specific detail — so there it stays specific.
     */
    private String unavailableMessage(String model) {
        if (desktop) {
            return "Aria's thinking engine is starting back up. Please wait a moment and try again.";
        }
        return "Local AI model is unavailable. Ensure Ollama is running and the model '"
                + model + "' is pulled.";
    }

    @Override
    public String name() {
        return "ollama";
    }

    private static int asInt(Object o) {
        return (o instanceof Number n) ? n.intValue() : 0;
    }
}
