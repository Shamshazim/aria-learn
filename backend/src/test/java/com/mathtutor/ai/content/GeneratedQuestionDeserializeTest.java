package com.mathtutor.ai.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The local model sometimes emits correctAnswer/solution as arrays. These used to crash the
 * whole batch ("Cannot deserialize value of type String from Array value"); the lenient
 * deserializer must now coerce them to a string instead.
 */
class GeneratedQuestionDeserializeTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void correctAnswerAsArrayIsCoercedToString() throws Exception {
        String json = """
                {"questions":[
                  {"type":"SHORT_ANSWER","difficulty":"EASY","prompt":"2+2?",
                   "choices":[],"correctAnswer":"4","solution":"add"},
                  {"type":"SHORT_ANSWER","difficulty":"EASY","prompt":"name a vowel",
                   "choices":[],"correctAnswer":["a","e","i"],"solution":"any vowel"}
                ]}
                """;
        PracticeBatch batch = mapper.readValue(json, PracticeBatch.class);

        assertThat(batch.questions()).hasSize(2);
        assertThat(batch.questions().get(0).correctAnswer()).isEqualTo("4");
        assertThat(batch.questions().get(1).correctAnswer()).isEqualTo("a, e, i");
    }

    @Test
    void solutionAsArrayOfStepsIsJoined() throws Exception {
        String json = """
                {"questions":[
                  {"type":"MULTIPLE_CHOICE","difficulty":"MEDIUM","prompt":"pick one",
                   "choices":["A","B"],"correctAnswer":"A",
                   "solution":["Step 1: look","Step 2: choose A"]}
                ]}
                """;
        PracticeBatch batch = mapper.readValue(json, PracticeBatch.class);

        assertThat(batch.questions().get(0).solution()).isEqualTo("Step 1: look, Step 2: choose A");
    }

    @Test
    void plainStringsStillWork() throws Exception {
        String json = """
                {"questions":[
                  {"type":"MULTIPLE_CHOICE","difficulty":"EASY","prompt":"1+1?",
                   "choices":["1","2"],"correctAnswer":"2","solution":"one plus one"}
                ]}
                """;
        PracticeBatch batch = mapper.readValue(json, PracticeBatch.class);

        assertThat(batch.questions().get(0).correctAnswer()).isEqualTo("2");
        assertThat(batch.questions().get(0).solution()).isEqualTo("one plus one");
    }
}
