package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** AI evaluation of a single homework answer. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AnswerEvaluation(
        boolean correct,
        int partialCredit,
        String feedback,
        String misconception) {
}
