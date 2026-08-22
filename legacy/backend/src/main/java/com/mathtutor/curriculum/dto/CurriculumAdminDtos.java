package com.mathtutor.curriculum.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class CurriculumAdminDtos {

    // ----- Admin tree (includes inactive items) ----------------------------

    public record AdminTopicDto(UUID id, String name, int ordering, List<String> objectives,
                                boolean active, long studentsWithProgress) {
    }

    public record AdminLessonDto(UUID id, String name, int ordering, boolean active,
                                 List<AdminTopicDto> topics) {
    }

    public record AdminUnitDto(UUID id, String name, int ordering, boolean active,
                               List<AdminLessonDto> lessons) {
    }

    public record AdminGradeDto(UUID id, String name, int levelOrder, boolean active,
                                List<AdminUnitDto> units) {
    }

    public record AdminSubjectDto(UUID id, String name, String slug, String description,
                                  boolean active, List<AdminGradeDto> grades) {
    }

    // ----- Requests --------------------------------------------------------

    public record SubjectReq(@NotBlank String name, String slug, String description, Boolean active) {
    }

    public record GradeReq(UUID subjectId, @NotBlank String name, Integer levelOrder, Boolean active) {
    }

    public record UnitReq(UUID gradeId, @NotBlank String name, Integer ordering, Boolean active) {
    }

    public record LessonReq(UUID unitId, @NotBlank String name, Integer ordering, Boolean active) {
    }

    public record TopicReq(UUID lessonId, @NotBlank String name, Integer ordering,
                           List<String> objectives, Boolean active) {
    }

    public record IdResponse(@NotNull UUID id) {
    }
}
