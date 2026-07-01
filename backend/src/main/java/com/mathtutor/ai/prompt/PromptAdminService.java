package com.mathtutor.ai.prompt;

import com.mathtutor.ai.prompt.dto.PromptDtos.*;
import com.mathtutor.ai.provider.ModelTier;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Manages the lifecycle of prompt versions: list, history, publish a new version,
 * and roll back to an earlier one. Exactly one version per name is active at a time
 * (also enforced by a DB partial-unique index).
 */
@Service
public class PromptAdminService {

    private final PromptTemplateRepository repository;
    private final com.mathtutor.ai.AiClient aiClient;

    public PromptAdminService(PromptTemplateRepository repository, com.mathtutor.ai.AiClient aiClient) {
        this.repository = repository;
        this.aiClient = aiClient;
    }

    /** Runs the active version of a prompt against the live model with the given variables. */
    public com.mathtutor.ai.AiClient.TestResult test(String name, java.util.Map<String, String> variables) {
        return aiClient.runTest(name, variables == null ? java.util.Map.of() : variables);
    }

    @Transactional(readOnly = true)
    public List<PromptSummary> listActive() {
        return repository.findByActiveTrueOrderByNameAsc().stream()
                .map(p -> new PromptSummary(p.getName(), p.getCategory(), p.getVersion(),
                        p.getModelTier(), p.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PromptVersionDto> history(String name) {
        List<PromptTemplate> versions = repository.findByNameOrderByVersionDesc(name);
        if (versions.isEmpty()) {
            throw new NotFoundException("No prompt named '" + name + "'");
        }
        return versions.stream().map(PromptAdminService::toDto).toList();
    }

    /**
     * Publishes a new version of an existing prompt. The current active version is
     * deactivated and the new (incremented) version becomes active.
     */
    @Transactional
    public PromptVersionDto createVersion(String name, CreateVersionRequest req) {
        PromptTemplate current = repository.findByNameAndActiveTrue(name)
                .orElseThrow(() -> new NotFoundException("No active prompt named '" + name + "'"));

        validateTier(req.modelTier());

        // Deactivate current and flush so the partial-unique index never sees two actives.
        current.setActive(false);
        repository.saveAndFlush(current);

        PromptTemplate next = new PromptTemplate();
        next.setName(name);
        next.setCategory(current.getCategory());
        next.setSystemPrompt(req.systemPrompt());
        next.setUserPromptTemplate(req.userPromptTemplate());
        next.setModelTier(req.modelTier() != null ? req.modelTier().toUpperCase() : current.getModelTier());
        next.setTemperature(req.temperature() != null ? req.temperature() : current.getTemperature());
        next.setMaxTokens(req.maxTokens() != null ? req.maxTokens() : current.getMaxTokens());
        next.setJsonMode(req.jsonMode() != null ? req.jsonMode() : current.isJsonMode());
        next.setVersion(repository.maxVersion(name) + 1);
        next.setActive(true);
        return toDto(repository.save(next));
    }

    /**
     * Makes an earlier version active again. The current active version is deactivated.
     */
    @Transactional
    public PromptVersionDto rollback(String name, int version) {
        PromptTemplate target = repository.findByNameAndVersion(name, version)
                .orElseThrow(() -> new NotFoundException(
                        "Prompt '" + name + "' has no version " + version));

        PromptTemplate current = repository.findByNameAndActiveTrue(name).orElse(null);
        if (current != null && current.getId().equals(target.getId())) {
            throw new BadRequestException("Version " + version + " is already active");
        }
        if (current != null) {
            current.setActive(false);
            repository.saveAndFlush(current);
        }
        target.setActive(true);
        return toDto(repository.save(target));
    }

    private void validateTier(String tier) {
        if (tier == null) {
            return;
        }
        try {
            ModelTier.valueOf(tier.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown model tier: " + tier + " (expected TEACH or FAST)");
        }
    }

    private static PromptVersionDto toDto(PromptTemplate p) {
        return new PromptVersionDto(p.getId(), p.getName(), p.getCategory(), p.getVersion(),
                p.isActive(), p.getSystemPrompt(), p.getUserPromptTemplate(), p.getModelTier(),
                p.getTemperature(), p.getMaxTokens(), p.isJsonMode(), p.getCreatedAt());
    }
}
