package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.util.List;

/**
 * Output of the ANSWER_VERIFY prompt: the independently re-derived correct option for
 * each multiple-choice question, used to correct a mislabeled answer key before grading.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VerifiedAnswerKeys(List<VerifiedKey> answers) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VerifiedKey(
            int index,
            String reasoning,
            @JsonDeserialize(using = LenientStringDeserializer.class) String correctAnswer) {
    }
}
