package com.mathtutor.ai;

import com.mathtutor.ai.prompt.PromptAdminService;
import com.mathtutor.ai.prompt.PromptTemplate;
import com.mathtutor.ai.prompt.PromptTemplateRepository;
import com.mathtutor.ai.prompt.dto.PromptDtos.CreateVersionRequest;
import com.mathtutor.ai.prompt.dto.PromptDtos.PromptVersionDto;
import com.mathtutor.common.BadRequestException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PromptAdminServiceTest {

    private final PromptTemplateRepository repo = mock(PromptTemplateRepository.class);
    private final PromptAdminService service = new PromptAdminService(repo, mock(com.mathtutor.ai.AiClient.class));

    private PromptTemplate prompt(String name, int version, boolean active) {
        PromptTemplate p = new PromptTemplate();
        p.setId(UUID.randomUUID());
        p.setName(name);
        p.setCategory("GENERATION");
        p.setSystemPrompt("old system");
        p.setUserPromptTemplate("old user");
        p.setModelTier("TEACH");
        p.setVersion(version);
        p.setActive(active);
        return p;
    }

    @Test
    void createVersionDeactivatesCurrentAndIncrementsVersion() {
        PromptTemplate v1 = prompt("KNOWLEDGE", 1, true);
        when(repo.findByNameAndActiveTrue("KNOWLEDGE")).thenReturn(Optional.of(v1));
        when(repo.maxVersion("KNOWLEDGE")).thenReturn(1);
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PromptVersionDto result = service.createVersion("KNOWLEDGE",
                new CreateVersionRequest("new system", "new user", null, null, null, null));

        // Previous version was deactivated and flushed before the new insert.
        assertThat(v1.isActive()).isFalse();
        verify(repo).saveAndFlush(v1);

        // New version is active, incremented, and inherits category from the previous one.
        assertThat(result.version()).isEqualTo(2);
        assertThat(result.active()).isTrue();
        assertThat(result.category()).isEqualTo("GENERATION");
        assertThat(result.systemPrompt()).isEqualTo("new system");
        assertThat(result.modelTier()).isEqualTo("TEACH");
    }

    @Test
    void createVersionInheritsModelSettingsWhenNotProvided() {
        PromptTemplate v1 = prompt("PRACTICE", 1, true);
        v1.setTemperature(0.6);
        v1.setMaxTokens(3072);
        when(repo.findByNameAndActiveTrue("PRACTICE")).thenReturn(Optional.of(v1));
        when(repo.maxVersion("PRACTICE")).thenReturn(1);
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PromptVersionDto result = service.createVersion("PRACTICE",
                new CreateVersionRequest("s", "u", null, null, null, null));

        assertThat(result.temperature()).isEqualTo(0.6);
        assertThat(result.maxTokens()).isEqualTo(3072);
    }

    @Test
    void rollbackActivatesTargetAndDeactivatesCurrent() {
        PromptTemplate v1 = prompt("KNOWLEDGE", 1, false);
        PromptTemplate v3 = prompt("KNOWLEDGE", 3, true);
        when(repo.findByNameAndVersion("KNOWLEDGE", 1)).thenReturn(Optional.of(v1));
        when(repo.findByNameAndActiveTrue("KNOWLEDGE")).thenReturn(Optional.of(v3));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PromptVersionDto result = service.rollback("KNOWLEDGE", 1);

        assertThat(v3.isActive()).isFalse();
        assertThat(result.version()).isEqualTo(1);
        assertThat(result.active()).isTrue();

        ArgumentCaptor<PromptTemplate> flushed = ArgumentCaptor.forClass(PromptTemplate.class);
        verify(repo).saveAndFlush(flushed.capture());
        assertThat(flushed.getValue().getVersion()).isEqualTo(3);
    }

    @Test
    void rollbackToAlreadyActiveVersionFails() {
        PromptTemplate v2 = prompt("KNOWLEDGE", 2, true);
        when(repo.findByNameAndVersion("KNOWLEDGE", 2)).thenReturn(Optional.of(v2));
        when(repo.findByNameAndActiveTrue("KNOWLEDGE")).thenReturn(Optional.of(v2));

        assertThatThrownBy(() -> service.rollback("KNOWLEDGE", 2))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("already active");
    }
}
