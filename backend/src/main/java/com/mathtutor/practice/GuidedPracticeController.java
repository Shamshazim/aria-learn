package com.mathtutor.practice;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.practice.dto.GuidedDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/practice/guided")
@PreAuthorize("hasRole('STUDENT')")
public class GuidedPracticeController {

    private final GuidedPracticeService service;

    public GuidedPracticeController(GuidedPracticeService service) {
        this.service = service;
    }

    /** Generates one guided question for the topic. */
    @PostMapping("/start")
    public GuidedQuestionDto start(@Valid @RequestBody StartGuidedRequest request) {
        return service.start(SecurityUtils.currentPrincipal(), request.topicId());
    }

    /** Submits an attempt: correct reveals the solution, wrong returns a hint. */
    @PostMapping("/attempt")
    public GuidedFeedback attempt(@Valid @RequestBody GuidedAttemptRequest request) {
        return service.attempt(SecurityUtils.currentPrincipal(), request);
    }

    /** Reveals the full solution when the child asks for it. */
    @GetMapping("/{questionId}/solution")
    public GuidedFeedback reveal(@PathVariable UUID questionId) {
        return service.reveal(questionId);
    }
}
