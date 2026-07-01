package com.mathtutor.curriculum.dto;

import java.util.List;
import java.util.UUID;

public class CurriculumDtos {

    public record SubjectDto(UUID id, String name, String slug, String description) {
    }

    public record GradeDto(UUID id, String name, int levelOrder, UUID subjectId) {
    }

    public record TopicDto(UUID id, String name, int ordering, List<String> learningObjectives) {
    }

    public record LessonDto(UUID id, String name, int ordering, List<TopicDto> topics) {
    }

    public record UnitDto(UUID id, String name, int ordering, List<LessonDto> lessons) {
    }

    public record GradeTreeDto(UUID gradeId, String gradeName, List<UnitDto> units) {
    }
}
