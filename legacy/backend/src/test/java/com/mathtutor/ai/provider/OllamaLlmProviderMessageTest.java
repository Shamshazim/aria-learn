package com.mathtutor.ai.provider;

import com.mathtutor.common.AiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * When the engine is unreachable the message goes straight to whoever is looking at the screen,
 * so it has to suit them. In the desktop app that is a child: the engine is bundled and restarts
 * itself, so telling them to start Ollama and pull a model names software they do not have and
 * cannot install. In development the reader is the developer, who can act on that detail.
 */
class OllamaLlmProviderMessageTest {

    /** Points at a closed loopback port so the call fails immediately. */
    private static OllamaLlmProvider providerFor(String... activeProfiles) {
        OllamaProperties props = new OllamaProperties();
        props.setBaseUrl("http://127.0.0.1:1");
        props.setTimeoutSeconds(2);
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(activeProfiles);
        return new OllamaLlmProvider(props, env);
    }

    private static LlmRequest request() {
        return new LlmRequest("You are a tutor.", "What is 2 + 2?", ModelTier.TEACH, 0.2, 256, false);
    }

    @Test
    void desktopTellsTheChildToWaitAndNeverNamesOllamaOrAModel() {
        OllamaLlmProvider provider = providerFor("desktop");

        assertThatThrownBy(() -> provider.complete(request()))
                .isInstanceOf(AiException.class)
                .satisfies(e -> {
                    assertThat(e.getMessage()).contains("try again");
                    assertThat(e.getMessage()).doesNotContainIgnoringCase("ollama");
                    assertThat(e.getMessage()).doesNotContain("qwen2.5");
                    assertThat(e.getMessage()).doesNotContainIgnoringCase("pulled");
                });
    }

    @Test
    void developmentKeepsTheSpecificActionableDetail() {
        OllamaLlmProvider provider = providerFor();

        assertThatThrownBy(() -> provider.complete(request()))
                .isInstanceOf(AiException.class)
                .hasMessageContaining("Ollama")
                .hasMessageContaining("qwen2.5:7b");
    }
}
