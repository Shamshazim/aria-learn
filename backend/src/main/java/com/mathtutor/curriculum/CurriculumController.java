package com.mathtutor.curriculum;

import com.mathtutor.curriculum.dto.CurriculumDtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/curriculum")
public class CurriculumController {

    private final CurriculumService curriculumService;

    public CurriculumController(CurriculumService curriculumService) {
        this.curriculumService = curriculumService;
    }

    @GetMapping("/subjects")
    public List<SubjectDto> subjects() {
        return curriculumService.listSubjects();
    }

    @GetMapping("/subjects/{subjectId}/grades")
    public List<GradeDto> grades(@PathVariable UUID subjectId) {
        return curriculumService.listGrades(subjectId);
    }

    @GetMapping("/grades/{gradeId}/tree")
    public GradeTreeDto gradeTree(@PathVariable UUID gradeId) {
        return curriculumService.getGradeTree(gradeId);
    }

    @GetMapping("/topics/{topicId}")
    public TopicDto topic(@PathVariable UUID topicId) {
        return curriculumService.getTopic(topicId);
    }
}
