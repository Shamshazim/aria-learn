package com.mathtutor.curriculum;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GradeRepository extends JpaRepository<Grade, UUID> {
    List<Grade> findBySubjectIdAndActiveTrueOrderByLevelOrder(UUID subjectId);
    List<Grade> findBySubjectIdOrderByLevelOrder(UUID subjectId);
}
