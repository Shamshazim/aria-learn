package com.mathtutor.curriculum;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LessonRepository extends JpaRepository<Lesson, UUID> {
    List<Lesson> findByUnitIdAndActiveTrueOrderByOrdering(UUID unitId);
    List<Lesson> findByUnitIdOrderByOrdering(UUID unitId);
}
