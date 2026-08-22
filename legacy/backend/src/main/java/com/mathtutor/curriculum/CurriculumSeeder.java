package com.mathtutor.curriculum;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.List;

/**
 * Loads standards-based curricula from every JSON file under classpath:curriculum/ on
 * startup, idempotently: each grade/unit/lesson/topic is found by name (within its parent)
 * or created. Re-running never duplicates; existing curated topics keep their objectives.
 * Ordering follows the JSON so the sequence (and gating) is intentional. Drop in a new
 * subject file and it loads automatically.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class CurriculumSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CurriculumSeeder.class);
    private static final String PATTERN = "classpath*:curriculum/*.json";

    private final SubjectRepository subjectRepository;
    private final GradeRepository gradeRepository;
    private final UnitRepository unitRepository;
    private final LessonRepository lessonRepository;
    private final TopicRepository topicRepository;
    private final ObjectMapper objectMapper;

    CurriculumSeeder(SubjectRepository subjectRepository,
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

    record SeedTopic(String name, List<String> objectives) {}
    record SeedLesson(String name, List<SeedTopic> topics) {}
    record SeedUnit(String name, List<SeedLesson> lessons) {}
    record SeedGrade(String name, int level, List<SeedUnit> units) {}
    record SeedCurriculum(String subject, List<SeedGrade> grades) {}

    @Override
    @Transactional
    public void run(String... args) {
        Resource[] resources;
        try {
            resources = new PathMatchingResourcePatternResolver().getResources(PATTERN);
        } catch (Exception e) {
            log.warn("Could not scan curriculum files: {}", e.getMessage());
            return;
        }
        int total = 0;
        for (Resource resource : resources) {
            try (InputStream in = resource.getInputStream()) {
                SeedCurriculum seed = objectMapper.readValue(in, SeedCurriculum.class);
                total += seedSubject(seed);
            } catch (Exception e) {
                log.warn("Curriculum file '{}' not loaded: {}", resource.getFilename(), e.getMessage());
            }
        }
        if (total > 0) {
            log.info("Curriculum seed complete: {} new topics added", total);
        }
    }

    private int seedSubject(SeedCurriculum seed) {
        Subject subject = subjectRepository.findAllByOrderByName().stream()
                .filter(s -> s.getName().equalsIgnoreCase(seed.subject()))
                .findFirst()
                .orElseGet(() -> {
                    Subject s = new Subject();
                    s.setName(seed.subject());
                    s.setSlug(slugify(seed.subject()));
                    s.setActive(true);
                    return subjectRepository.save(s);
                });

        int newTopics = 0;
        for (SeedGrade sg : seed.grades()) {
            Grade grade = upsertGrade(subject.getId(), sg);
            int ui = 1;
            for (SeedUnit su : sg.units()) {
                Unit unit = upsertUnit(grade.getId(), su.name(), ui++);
                int li = 1;
                for (SeedLesson sl : su.lessons()) {
                    Lesson lesson = upsertLesson(unit.getId(), sl.name(), li++);
                    int ti = 1;
                    for (SeedTopic st : sl.topics()) {
                        if (upsertTopic(lesson.getId(), st, ti++)) {
                            newTopics++;
                        }
                    }
                }
            }
        }
        return newTopics;
    }

    private String slugify(String name) {
        String slug = name.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "subject-" + Math.abs(name.hashCode()) : slug;
    }

    private Grade upsertGrade(java.util.UUID subjectId, SeedGrade sg) {
        Grade grade = gradeRepository.findBySubjectIdOrderByLevelOrder(subjectId).stream()
                .filter(g -> g.getName().equalsIgnoreCase(sg.name()))
                .findFirst()
                .orElseGet(() -> {
                    Grade g = new Grade();
                    g.setSubjectId(subjectId);
                    g.setName(sg.name());
                    g.setActive(true);
                    return g;
                });
        grade.setLevelOrder(sg.level());
        return gradeRepository.save(grade);
    }

    private Unit upsertUnit(java.util.UUID gradeId, String name, int ordering) {
        Unit unit = unitRepository.findByGradeIdOrderByOrdering(gradeId).stream()
                .filter(u -> u.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElseGet(() -> {
                    Unit u = new Unit();
                    u.setGradeId(gradeId);
                    u.setName(name);
                    u.setActive(true);
                    return u;
                });
        unit.setOrdering(ordering);
        return unitRepository.save(unit);
    }

    private Lesson upsertLesson(java.util.UUID unitId, String name, int ordering) {
        Lesson lesson = lessonRepository.findByUnitIdOrderByOrdering(unitId).stream()
                .filter(l -> l.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElseGet(() -> {
                    Lesson l = new Lesson();
                    l.setUnitId(unitId);
                    l.setName(name);
                    l.setActive(true);
                    return l;
                });
        lesson.setOrdering(ordering);
        return lessonRepository.save(lesson);
    }

    /** @return true if a new topic was created. */
    private boolean upsertTopic(java.util.UUID lessonId, SeedTopic st, int ordering) {
        Topic existing = topicRepository.findByLessonIdOrderByOrdering(lessonId).stream()
                .filter(t -> t.getName().equalsIgnoreCase(st.name()))
                .findFirst()
                .orElse(null);
        if (existing != null) {
            existing.setOrdering(ordering); // keep existing objectives; just fix order
            topicRepository.save(existing);
            return false;
        }
        Topic t = new Topic();
        t.setLessonId(lessonId);
        t.setName(st.name());
        t.setOrdering(ordering);
        t.setActive(true);
        t.setLearningObjectives(writeObjectives(st.objectives()));
        topicRepository.save(t);
        return true;
    }

    private String writeObjectives(List<String> objectives) {
        if (objectives == null || objectives.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(objectives);
        } catch (Exception e) {
            return null;
        }
    }
}
