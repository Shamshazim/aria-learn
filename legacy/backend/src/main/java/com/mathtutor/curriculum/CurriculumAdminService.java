package com.mathtutor.curriculum;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.dto.CurriculumAdminDtos.*;
import com.mathtutor.mastery.MasteryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Write side of the curriculum: lets the parent/admin add and edit subjects, grades,
 * units, lessons, and topics. Deletes are soft (is_active = false) so student history
 * is preserved.
 */
@Service
public class CurriculumAdminService {

    private final SubjectRepository subjectRepository;
    private final GradeRepository gradeRepository;
    private final UnitRepository unitRepository;
    private final LessonRepository lessonRepository;
    private final TopicRepository topicRepository;
    private final MasteryService masteryService;
    private final ObjectMapper objectMapper;

    CurriculumAdminService(SubjectRepository subjectRepository,
                           GradeRepository gradeRepository,
                           UnitRepository unitRepository,
                           LessonRepository lessonRepository,
                           TopicRepository topicRepository,
                           MasteryService masteryService,
                           ObjectMapper objectMapper) {
        this.subjectRepository = subjectRepository;
        this.gradeRepository = gradeRepository;
        this.unitRepository = unitRepository;
        this.lessonRepository = lessonRepository;
        this.topicRepository = topicRepository;
        this.masteryService = masteryService;
        this.objectMapper = objectMapper;
    }

    // ----- Read (full tree incl. inactive) ---------------------------------

    @Transactional(readOnly = true)
    public List<AdminSubjectDto> fullTree() {
        return subjectRepository.findAllByOrderByName().stream().map(subject ->
                new AdminSubjectDto(subject.getId(), subject.getName(), subject.getSlug(),
                        subject.getDescription(), subject.isActive(),
                        gradeRepository.findBySubjectIdOrderByLevelOrder(subject.getId()).stream().map(grade ->
                                new AdminGradeDto(grade.getId(), grade.getName(), grade.getLevelOrder(), grade.isActive(),
                                        unitRepository.findByGradeIdOrderByOrdering(grade.getId()).stream().map(unit ->
                                                new AdminUnitDto(unit.getId(), unit.getName(), unit.getOrdering(), unit.isActive(),
                                                        lessonRepository.findByUnitIdOrderByOrdering(unit.getId()).stream().map(lesson ->
                                                                new AdminLessonDto(lesson.getId(), lesson.getName(), lesson.getOrdering(), lesson.isActive(),
                                                                        topicRepository.findByLessonIdOrderByOrdering(lesson.getId()).stream().map(topic ->
                                                                                new AdminTopicDto(topic.getId(), topic.getName(), topic.getOrdering(),
                                                                                        parseObjectives(topic.getLearningObjectives()), topic.isActive(),
                                                                                        masteryService.countStudentsWithProgress(topic.getId()))
                                                                        ).toList())
                                                        ).toList())
                                        ).toList())
                        ).toList())
        ).toList();
    }

    // ----- Subjects --------------------------------------------------------

    @Transactional
    public UUID createSubject(SubjectReq req) {
        Subject s = new Subject();
        s.setName(req.name().trim());
        s.setSlug(slugify(req.slug(), req.name()));
        s.setDescription(req.description());
        s.setActive(req.active() == null || req.active());
        return subjectRepository.save(s).getId();
    }

    @Transactional
    public void updateSubject(UUID id, SubjectReq req) {
        Subject s = subjectRepository.findById(id).orElseThrow(() -> new NotFoundException("Subject not found"));
        s.setName(req.name().trim());
        if (req.description() != null) s.setDescription(req.description());
        if (req.active() != null) s.setActive(req.active());
        subjectRepository.save(s);
    }

    // ----- Grades ----------------------------------------------------------

    @Transactional
    public UUID createGrade(GradeReq req) {
        if (req.subjectId() == null || !subjectRepository.existsById(req.subjectId())) {
            throw new NotFoundException("Subject not found");
        }
        Grade g = new Grade();
        g.setSubjectId(req.subjectId());
        g.setName(req.name().trim());
        g.setLevelOrder(req.levelOrder() == null ? nextGradeOrder(req.subjectId()) : req.levelOrder());
        g.setActive(req.active() == null || req.active());
        return gradeRepository.save(g).getId();
    }

    @Transactional
    public void updateGrade(UUID id, GradeReq req) {
        Grade g = gradeRepository.findById(id).orElseThrow(() -> new NotFoundException("Grade not found"));
        g.setName(req.name().trim());
        if (req.levelOrder() != null) g.setLevelOrder(req.levelOrder());
        if (req.active() != null) g.setActive(req.active());
        gradeRepository.save(g);
    }

    // ----- Units -----------------------------------------------------------

    @Transactional
    public UUID createUnit(UnitReq req) {
        if (req.gradeId() == null || !gradeRepository.existsById(req.gradeId())) {
            throw new NotFoundException("Grade not found");
        }
        Unit u = new Unit();
        u.setGradeId(req.gradeId());
        u.setName(req.name().trim());
        u.setOrdering(req.ordering() == null ? unitRepository.findByGradeIdOrderByOrdering(req.gradeId()).size() + 1 : req.ordering());
        u.setActive(req.active() == null || req.active());
        return unitRepository.save(u).getId();
    }

    @Transactional
    public void updateUnit(UUID id, UnitReq req) {
        Unit u = unitRepository.findById(id).orElseThrow(() -> new NotFoundException("Unit not found"));
        u.setName(req.name().trim());
        if (req.ordering() != null) u.setOrdering(req.ordering());
        if (req.active() != null) u.setActive(req.active());
        unitRepository.save(u);
    }

    // ----- Lessons ---------------------------------------------------------

    @Transactional
    public UUID createLesson(LessonReq req) {
        if (req.unitId() == null || !unitRepository.existsById(req.unitId())) {
            throw new NotFoundException("Unit not found");
        }
        Lesson l = new Lesson();
        l.setUnitId(req.unitId());
        l.setName(req.name().trim());
        l.setOrdering(req.ordering() == null ? lessonRepository.findByUnitIdOrderByOrdering(req.unitId()).size() + 1 : req.ordering());
        l.setActive(req.active() == null || req.active());
        return lessonRepository.save(l).getId();
    }

    @Transactional
    public void updateLesson(UUID id, LessonReq req) {
        Lesson l = lessonRepository.findById(id).orElseThrow(() -> new NotFoundException("Lesson not found"));
        l.setName(req.name().trim());
        if (req.ordering() != null) l.setOrdering(req.ordering());
        if (req.active() != null) l.setActive(req.active());
        lessonRepository.save(l);
    }

    // ----- Topics ----------------------------------------------------------

    @Transactional
    public UUID createTopic(TopicReq req) {
        if (req.lessonId() == null || !lessonRepository.existsById(req.lessonId())) {
            throw new NotFoundException("Lesson not found");
        }
        Topic t = new Topic();
        t.setLessonId(req.lessonId());
        t.setName(req.name().trim());
        t.setOrdering(req.ordering() == null ? topicRepository.findByLessonIdOrderByOrdering(req.lessonId()).size() + 1 : req.ordering());
        t.setLearningObjectives(writeObjectives(req.objectives()));
        t.setActive(req.active() == null || req.active());
        return topicRepository.save(t).getId();
    }

    @Transactional
    public void updateTopic(UUID id, TopicReq req) {
        Topic t = topicRepository.findById(id).orElseThrow(() -> new NotFoundException("Topic not found"));
        t.setName(req.name().trim());
        if (req.ordering() != null) t.setOrdering(req.ordering());
        if (req.objectives() != null) t.setLearningObjectives(writeObjectives(req.objectives()));
        if (req.active() != null) t.setActive(req.active());
        topicRepository.save(t);
    }

    @Transactional(readOnly = true)
    public long topicProgressCount(UUID topicId) {
        if (!topicRepository.existsById(topicId)) {
            throw new NotFoundException("Topic not found");
        }
        return masteryService.countStudentsWithProgress(topicId);
    }

    // ----- helpers ---------------------------------------------------------

    private int nextGradeOrder(UUID subjectId) {
        return gradeRepository.findBySubjectIdOrderByLevelOrder(subjectId).stream()
                .mapToInt(Grade::getLevelOrder).max().orElse(0) + 1;
    }

    private String slugify(String slug, String name) {
        String base = (slug != null && !slug.isBlank()) ? slug : name;
        String result = base.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (result.isBlank()) {
            throw new BadRequestException("Could not derive a slug from the name");
        }
        return result;
    }

    private String writeObjectives(List<String> objectives) {
        if (objectives == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(objectives);
        } catch (Exception e) {
            return "[]";
        }
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
