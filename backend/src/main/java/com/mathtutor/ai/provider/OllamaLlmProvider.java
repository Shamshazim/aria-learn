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

    public OllamaLlmProvider(OllamaProperties props) {
        this.props = props;
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
            throw new AiException("Local AI model is unavailable. Ensure Ollama is running and the model '"
                    + model + "' is pulled.", e);
        }
    }

    @Override
    public String name() {
        return "ollama";
    }

    private static int asInt(Object o) {
        return (o instanceof Number n) ? n.intValue() : 0;
    }
}
