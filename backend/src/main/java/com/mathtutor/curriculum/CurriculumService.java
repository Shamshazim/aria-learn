package com.mathtutor.curriculum;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.dto.CurriculumDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CurriculumService {

    private final SubjectRepository subjectRepository;
    private final GradeRepository gradeRepository;
    private final UnitRepository unitRepository;
    private final LessonRepository lessonRepository;
    private final TopicRepository topicRepository;
    private final ObjectMapper objectMapper;

    CurriculumService(SubjectRepository subjectRepository,
                      GradeRepository gradeRepository,
                      UnitRepository unitRepository,
                      LessonRepository lessonRepository,
                      TopicRepository topicRepository,
                      ObjectMapper objectMapper) {
        this.subjectRepository = subjectRepository;
        this.gradeRepository = gradeRepository;
        this.unitRepository = unitRepository;
        this.lessonRepository = lessonRepository;
        this.topicRepository = topicRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SubjectDto> listSubjects() {
        return subjectRepository.findByActiveTrueOrderByName().stream()
                .map(s -> new SubjectDto(s.getId(), s.getName(), s.getSlug(), s.getDescription()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GradeDto> listGrades(UUID subjectId) {
        return gradeRepository.findBySubjectIdAndActiveTrueOrderByLevelOrder(subjectId).stream()
                .map(g -> new GradeDto(g.getId(), g.getName(), g.getLevelOrder(), g.getSubjectId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public GradeTreeDto getGradeTree(UUID gradeId) {
        Grade grade = gradeRepository.findById(gradeId)
                .orElseThrow(() -> new NotFoundException("Grade not found"));

        List<UnitDto> units = unitRepository.findByGradeIdAndActiveTrueOrderByOrdering(gradeId).stream()
                .map(unit -> {
                    List<LessonDto> lessons = lessonRepository
                            .findByUnitIdAndActiveTrueOrderByOrdering(unit.getId()).stream()
                            .map(lesson -> {
                                List<TopicDto> topics = topicRepository
                                        .findByLessonIdAndActiveTrueOrderByOrdering(lesson.getId()).stream()
                                        .map(this::toTopicDto)
                                        .toList();
                                return new LessonDto(lesson.getId(), lesson.getName(),
                                        lesson.getOrdering(), topics);
                            })
                            .toList();
                    return new UnitDto(unit.getId(), unit.getName(), unit.getOrdering(), lessons);
                })
                .toList();

        return new GradeTreeDto(grade.getId(), grade.getName(), units);
    }

    @Transactional(readOnly = true)
    public TopicDto getTopic(UUID topicId) {
        Topic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new NotFoundException("Topic not found"));
        return toTopicDto(topic);
    }

    public Topic requireTopic(UUID topicId) {
        return topicRepository.findById(topicId)
                .orElseThrow(() -> new NotFoundException("Topic not found"));
    }

    /**
     * Walks topic -> lesson -> unit -> grade -> subject to assemble the names and
     * objectives needed for AI prompt context.
     */
    @Transactional(readOnly = true)
    public TopicContext resolveTopicContext(UUID topicId) {
        Topic topic = requireTopic(topicId);
        Lesson lesson = lessonRepository.findById(topic.getLessonId())
                .orElseThrow(() -> new NotFoundException("Lesson not found"));
        Unit unit = unitRepository.findById(lesson.getUnitId())
                .orElseThrow(() -> new NotFoundException("Unit not found"));
        Grade grade = gradeRepository.findById(unit.getGradeId())
                .orElseThrow(() -> new NotFoundException("Grade not found"));
        Subject subject = subjectRepository.findById(grade.getSubjectId())
                .orElseThrow(() -> new NotFoundException("Subject not found"));

        List<String> objectives = parseObjectives(topic.getLearningObjectives());
        String objectivesText = objectives.isEmpty() ? "" : String.join("; ", objectives);

        return new TopicContext(topic.getId(), topic.getName(),
                grade.getName(), subject.getName(), objectivesText);
    }

    public record TopicContext(UUID topicId, String topicName, String gradeName,
                               String subjectName, String objectives) {
    }

    /** The grade a topic belongs to (topic -> lesson -> unit -> grade). */
    @Transactional(readOnly = true)
    public UUID gradeIdForTopic(UUID topicId) {
        Topic topic = requireTopic(topicId);
        Lesson lesson = lessonRepository.findById(topic.getLessonId())
                .orElseThrow(() -> new NotFoundException("Lesson not found"));
        Unit unit = unitRepository.findById(lesson.getUnitId())
                .orElseThrow(() -> new NotFoundException("Unit not found"));
        return unit.getGradeId();
    }

    /** All active topic ids within a grade (for filtering per-subject data). */
    @Transactional(readOnly = true)
    public java.util.Set<UUID> topicIdsForGrade(UUID gradeId) {
        java.util.Set<UUID> ids = new java.util.HashSet<>();
        for (var unit : unitRepository.findByGradeIdAndActiveTrueOrderByOrdering(gradeId)) {
            for (var lesson : lessonRepository.findByUnitIdAndActiveTrueOrderByOrdering(unit.getId())) {
                for (var topic : topicRepository.findByLessonIdAndActiveTrueOrderByOrdering(lesson.getId())) {
                    ids.add(topic.getId());
                }
            }
        }
        return ids;
    }

    @Transactional(readOnly = true)
    public GradeInfo gradeInfo(UUID gradeId) {
        Grade grade = gradeRepository.findById(gradeId)
                .orElseThrow(() -> new NotFoundException("Grade not found"));
        Subject subject = subjectRepository.findById(grade.getSubjectId())
                .orElseThrow(() -> new NotFoundException("Subject not found"));
        return new GradeInfo(grade.getId(), grade.getName(), subject.getId(), subject.getName());
    }

    public record GradeInfo(UUID gradeId, String gradeName, UUID subjectId, String subjectName) {
    }

    private TopicDto toTopicDto(Topic topic) {
        return new TopicDto(topic.getId(), topic.getName(), topic.getOrdering(),
                parseObjectives(topic.getLearningObjectives()));
    }

    private List<String> parseObjectives(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
