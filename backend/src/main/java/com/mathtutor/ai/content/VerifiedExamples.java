package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.util.List;

/**
 * Output of the EXAMPLE_VERIFY prompt: re-derived, correct steps and final answer for each
 * worked example, used to fix a wrong worked solution before it is shown to a child.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VerifiedExamples(List<VerifiedExample> examples) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VerifiedExample(
            int index,
            List<String> steps,
            @JsonDeserialize(using = LenientStringDeserializer.class) String answer) {
    }
}
