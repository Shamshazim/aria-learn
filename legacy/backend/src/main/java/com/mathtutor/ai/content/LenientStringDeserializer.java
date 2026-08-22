package com.mathtutor.ai.content;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Deserializes a JSON value into a String, tolerating the shapes a local LLM sometimes
 * emits by mistake. A plain scalar is used as-is; an array (e.g. correctAnswer: ["7","seven"]
 * or solution: ["step 1","step 2"]) is flattened and joined with ", " instead of blowing up
 * the whole batch. This keeps quiz/homework/practice generation resilient to model slips.
 */
public class LenientStringDeserializer extends JsonDeserializer<String> {

    @Override
    public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        JsonNode node = p.getCodec().readTree(p);
        return flatten(node);
    }

    private String flatten(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isArray() || node.isObject()) {
            List<String> parts = new ArrayList<>();
            for (JsonNode child : node) {
                String s = flatten(child);
                if (s != null && !s.isBlank()) {
                    parts.add(s.trim());
                }
            }
            return String.join(", ", parts);
        }
        return node.asText();
    }
}
