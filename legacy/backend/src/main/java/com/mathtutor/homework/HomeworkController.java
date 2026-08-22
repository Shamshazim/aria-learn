package com.mathtutor.homework;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.homework.dto.HomeworkDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/homework")
@PreAuthorize("hasRole('STUDENT')")
public class HomeworkController {

    private final HomeworkService homeworkService;

    public HomeworkController(HomeworkService homeworkService) {
        this.homeworkService = homeworkService;
    }

    /** All homework for the signed-in student, newest first. */
    @GetMapping
    public List<HomeworkSummaryDto> list() {
        return homeworkService.listForStudent(SecurityUtils.currentPrincipal().id());
    }

    /** Opens (or creates) homework for a topic. */
    @PostMapping("/topic/{topicId}")
    public HomeworkDetailDto openForTopic(@PathVariable UUID topicId) {
        return homeworkService.openForTopic(SecurityUtils.currentPrincipal(), topicId);
    }

    /** The questions for a specific homework assignment. */
    @GetMapping("/{homeworkId}")
    public HomeworkDetailDto detail(@PathVariable UUID homeworkId) {
        return homeworkService.getDetail(SecurityUtils.currentPrincipal(), homeworkId);
    }

    /** Submits answers; evaluation runs asynchronously. */
    @PostMapping("/{homeworkId}/submit")
    public HomeworkResultDto submit(@PathVariable UUID homeworkId,
                                    @Valid @RequestBody SubmitHomeworkRequest request) {
        return homeworkService.submit(SecurityUtils.currentPrincipal(), homeworkId, request);
    }

    /** Poll this until status is EVALUATED to get the AI feedback. */
    @GetMapping("/{homeworkId}/result")
    public HomeworkResultDto result(@PathVariable UUID homeworkId) {
        return homeworkService.getResult(SecurityUtils.currentPrincipal(), homeworkId);
    }
}
