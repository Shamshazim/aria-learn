package com.mathtutor.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiClientJsonTest {

    @Test
    void stripsMarkdownFences() {
        String raw = "```json\n{\"a\":1}\n```";
        assertThat(AiClient.extractJson(raw)).isEqualTo("{\"a\":1}");
    }

    @Test
    void isolatesObjectFromSurroundingProse() {
        String raw = "Sure! Here is your JSON: {\"questions\":[]} Hope that helps!";
        assertThat(AiClient.extractJson(raw)).isEqualTo("{\"questions\":[]}");
    }

    @Test
    void handlesArrayRoot() {
        String raw = "[{\"x\":1}]";
        assertThat(AiClient.extractJson(raw)).isEqualTo("[{\"x\":1}]");
    }

    @Test
    void passesThroughCleanJson() {
        String raw = "{\"explanation\":\"hi\"}";
        assertThat(AiClient.extractJson(raw)).isEqualTo("{\"explanation\":\"hi\"}");
    }
}
