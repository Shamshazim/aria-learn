package com.mathtutor.practice;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.ai.content.GeneratedQuestion;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Persists AI-generated questions into the question bank and (de)serializes choices.
 *  Shared by independent practice, guided practice, and quizzes. */
@Service
public class QuestionStore {

    private final QuestionBankRepository repository;
    private final ObjectMapper objectMapper;

    public QuestionStore(QuestionBankRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public QuestionBank persist(UUID topicId, GeneratedQuestion gq, String fallbackDifficulty, String source) {
        QuestionBank q = new QuestionBank();
        q.setTopicId(topicId);
        q.setType(gq.type() == null ? "SHORT_ANSWER" : gq.type().toUpperCase());
        q.setDifficulty(gq.difficulty() == null ? fallbackDifficulty : gq.difficulty().toUpperCase());
        q.setPromptText(gq.prompt());
        q.setChoices(writeChoices(gq.choices()));
        q.setCorrectAnswer(gq.correctAnswer() == null ? "" : gq.correctAnswer());
        q.setSolution(gq.solution());
        q.setSource(source);
        return repository.save(q);
    }

    public String writeChoices(List<String> choices) {
        if (choices == null || choices.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(choices);
        } catch (Exception e) {
            return null;
        }
    }

    public List<String> readChoices(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
