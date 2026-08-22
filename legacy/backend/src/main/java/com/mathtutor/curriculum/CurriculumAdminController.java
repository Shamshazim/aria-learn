package com.mathtutor.curriculum;

import com.mathtutor.curriculum.dto.CurriculumAdminDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/curriculum")
@PreAuthorize("hasRole('PARENT')")
public class CurriculumAdminController {

    private final CurriculumAdminService service;

    public CurriculumAdminController(CurriculumAdminService service) {
        this.service = service;
    }

    /** Full curriculum tree including inactive items, for the admin UI. */
    @GetMapping("/tree")
    public List<AdminSubjectDto> tree() {
        return service.fullTree();
    }

    @PostMapping("/subjects")
    public IdResponse createSubject(@Valid @RequestBody SubjectReq req) {
        return new IdResponse(service.createSubject(req));
    }

    @PutMapping("/subjects/{id}")
    public void updateSubject(@PathVariable UUID id, @Valid @RequestBody SubjectReq req) {
        service.updateSubject(id, req);
    }

    @PostMapping("/grades")
    public IdResponse createGrade(@Valid @RequestBody GradeReq req) {
        return new IdResponse(service.createGrade(req));
    }

    @PutMapping("/grades/{id}")
    public void updateGrade(@PathVariable UUID id, @Valid @RequestBody GradeReq req) {
        service.updateGrade(id, req);
    }

    @PostMapping("/units")
    public IdResponse createUnit(@Valid @RequestBody UnitReq req) {
        return new IdResponse(service.createUnit(req));
    }

    @PutMapping("/units/{id}")
    public void updateUnit(@PathVariable UUID id, @Valid @RequestBody UnitReq req) {
        service.updateUnit(id, req);
    }

    @PostMapping("/lessons")
    public IdResponse createLesson(@Valid @RequestBody LessonReq req) {
        return new IdResponse(service.createLesson(req));
    }

    @PutMapping("/lessons/{id}")
    public void updateLesson(@PathVariable UUID id, @Valid @RequestBody LessonReq req) {
        service.updateLesson(id, req);
    }

    @PostMapping("/topics")
    public IdResponse createTopic(@Valid @RequestBody TopicReq req) {
        return new IdResponse(service.createTopic(req));
    }

    @PutMapping("/topics/{id}")
    public void updateTopic(@PathVariable UUID id, @Valid @RequestBody TopicReq req) {
        service.updateTopic(id, req);
    }

    /** How many students have progress on a topic (used to warn before deactivating). */
    @GetMapping("/topics/{id}/usage")
    public Map<String, Long> topicUsage(@PathVariable UUID id) {
        return Map.of("studentsWithProgress", service.topicProgressCount(id));
    }
}
