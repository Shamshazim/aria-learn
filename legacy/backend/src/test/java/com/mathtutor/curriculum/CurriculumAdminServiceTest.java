package com.mathtutor.curriculum;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.curriculum.dto.CurriculumAdminDtos.TopicReq;
import com.mathtutor.mastery.MasteryService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CurriculumAdminServiceTest {

    private final SubjectRepository subjectRepo = mock(SubjectRepository.class);
    private final GradeRepository gradeRepo = mock(GradeRepository.class);
    private final UnitRepository unitRepo = mock(UnitRepository.class);
    private final LessonRepository lessonRepo = mock(LessonRepository.class);
    private final TopicRepository topicRepo = mock(TopicRepository.class);
    private final MasteryService masteryService = mock(MasteryService.class);

    private final CurriculumAdminService service = new CurriculumAdminService(
            subjectRepo, gradeRepo, unitRepo, lessonRepo, topicRepo, masteryService, new ObjectMapper());

    @Test
    void createTopicSetsFieldsOrderingAndObjectives() {
        UUID lessonId = UUID.randomUUID();
        when(lessonRepo.existsById(lessonId)).thenReturn(true);
        when(topicRepo.findByLessonIdOrderByOrdering(lessonId)).thenReturn(List.of()); // first topic -> ordering 1
        when(topicRepo.save(any())).thenAnswer(inv -> {
            Topic t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        UUID id = service.createTopic(new TopicReq(lessonId, "Dividing by 2",
                null, List.of("Halve a number", "Check with multiplication"), null));

        assertThat(id).isNotNull();
        ArgumentCaptor<Topic> cap = ArgumentCaptor.forClass(Topic.class);
        verify(topicRepo).save(cap.capture());
        Topic saved = cap.getValue();
        assertThat(saved.getName()).isEqualTo("Dividing by 2");
        assertThat(saved.getOrdering()).isEqualTo(1);
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getLearningObjectives()).contains("Halve a number");
    }

    @Test
    void updateTopicCanSoftDelete() {
        UUID id = UUID.randomUUID();
        Topic topic = new Topic();
        topic.setId(id);
        topic.setName("Old");
        topic.setActive(true);
        when(topicRepo.findById(id)).thenReturn(Optional.of(topic));
        when(topicRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.updateTopic(id, new TopicReq(null, "Old", null, null, false));

        assertThat(topic.isActive()).isFalse(); // soft-deleted, not removed
        verify(topicRepo).save(topic);
    }

    @Test
    void topicProgressCountDelegatesToMastery() {
        UUID id = UUID.randomUUID();
        when(topicRepo.existsById(id)).thenReturn(true);
        when(masteryService.countStudentsWithProgress(id)).thenReturn(3L);

        assertThat(service.topicProgressCount(id)).isEqualTo(3L);
    }
}
