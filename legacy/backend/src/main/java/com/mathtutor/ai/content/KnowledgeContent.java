package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/** Structured knowledge article produced by the AI for a topic. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KnowledgeContent(
        String explanation,
        List<String> realWorldExamples,
        List<Visual> visuals,
        List<String> commonMistakes,
        List<String> tips,
        String summary) {
}
