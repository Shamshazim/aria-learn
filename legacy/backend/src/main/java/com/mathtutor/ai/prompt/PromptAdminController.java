package com.mathtutor.ai.prompt;

import com.mathtutor.ai.prompt.dto.PromptDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin API for managing AI prompts. Parent (admin) only.
 * The visual editor/test-runner UI is built on top of this in a later milestone.
 */
@RestController
@RequestMapping("/api/v1/admin/prompts")
@PreAuthorize("hasRole('PARENT')")
public class PromptAdminController {

    private final PromptAdminService service;

    public PromptAdminController(PromptAdminService service) {
        this.service = service;
    }

    /** All prompts, current active version each. */
    @GetMapping
    public List<PromptSummary> list() {
        return service.listActive();
    }

    /** Full version history for one named prompt, newest first. */
    @GetMapping("/{name}/history")
    public List<PromptVersionDto> history(@PathVariable String name) {
        return service.history(name);
    }

    /** Publish a new version (becomes active; previous version is retained). */
    @PostMapping("/{name}")
    public PromptVersionDto createVersion(@PathVariable String name,
                                          @Valid @RequestBody CreateVersionRequest request) {
        return service.createVersion(name, request);
    }

    /** Roll back to an earlier version (it becomes active again). */
    @PostMapping("/{name}/rollback")
    public PromptVersionDto rollback(@PathVariable String name,
                                     @Valid @RequestBody RollbackRequest request) {
        return service.rollback(name, request.version());
    }

    /** Runs the active prompt against the live model with provided variables (logged as a test). */
    @PostMapping("/{name}/test")
    public com.mathtutor.ai.AiClient.TestResult test(@PathVariable String name,
                                                     @RequestBody TestRequest request) {
        return service.test(name, request.variables());
    }
}
