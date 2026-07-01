package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.util.List;

/**
 * A single AI-generated question. For M1 we support MULTIPLE_CHOICE and SHORT_ANSWER.
 * choices is populated only for MULTIPLE_CHOICE.
 *
 * prompt, correctAnswer and solution use a lenient deserializer because the local model
 * occasionally emits them as arrays; we coerce to a string rather than fail the whole batch.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeneratedQuestion(
        String type,
        String difficulty,
        @JsonDeserialize(using = LenientStringDeserializer.class) String prompt,
        List<String> choices,
        @JsonDeserialize(using = LenientStringDeserializer.class) String correctAnswer,
        @JsonDeserialize(using = LenientStringDeserializer.class) String solution) {
}
