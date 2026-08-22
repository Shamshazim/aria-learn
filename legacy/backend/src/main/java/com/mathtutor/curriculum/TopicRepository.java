package com.mathtutor.curriculum;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TopicRepository extends JpaRepository<Topic, UUID> {
    List<Topic> findByLessonIdAndActiveTrueOrderByOrdering(UUID lessonId);
    List<Topic> findByLessonIdOrderByOrdering(UUID lessonId);
}
