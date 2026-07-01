package com.mathtutor.ai;

import com.mathtutor.ai.prompt.PromptRegistry;
import com.mathtutor.ai.prompt.PromptTemplate;
import com.mathtutor.ai.prompt.PromptTemplateRepository;
import com.mathtutor.ai.prompt.ResolvedPrompt;
import com.mathtutor.common.AiException;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PromptRegistryTest {

    private final PromptTemplateRepository repository = mock(PromptTemplateRepository.class);
    private final PromptRegistry registry = new PromptRegistry(repository);

    private PromptTemplate template(String system, String user) {
        PromptTemplate t = new PromptTemplate();
        t.setName("KNOWLEDGE");
        t.setCategory("GENERATION");
        t.setSystemPrompt(system);
        t.setUserPromptTemplate(user);
        t.setModelTier("TEACH");
        t.setVersion(3);
        return t;
    }

    @Test
    void substitutesVariablesIncludingSubjectName() {
        when(repository.findByNameAndActiveTrue("KNOWLEDGE"))
                .thenReturn(Optional.of(template(
                        "You are Aria, a {{subject_name}} tutor.",
                        "Teach {{topic_name}} in {{grade_name}}.")));

        ResolvedPrompt resolved = registry.resolve("KNOWLEDGE", Map.of(
                "subject_name", "Mathematics",
                "topic_name", "Multiplication",
                "grade_name", "Grade 4"));

        assertThat(resolved.systemPrompt()).isEqualTo("You are Aria, a Mathematics tutor.");
        assertThat(resolved.userPrompt()).isEqualTo("Teach Multiplication in Grade 4.");
        assertThat(resolved.version()).isEqualTo(3);
    }

    @Test
    void missingRequiredVariableFailsFast() {
        when(repository.findByNameAndActiveTrue("KNOWLEDGE"))
                .thenReturn(Optional.of(template("S", "Teach {{topic_name}}.")));

        assertThatThrownBy(() -> registry.resolve("KNOWLEDGE", Map.of()))
                .isInstanceOf(AiException.class)
                .hasMessageContaining("topic_name");
    }

    @Test
    void unknownPromptNameThrows() {
        when(repository.findByNameAndActiveTrue("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> registry.resolve("NOPE", Map.of()))
                .isInstanceOf(AiException.class)
                .hasMessageContaining("NOPE");
    }
}
