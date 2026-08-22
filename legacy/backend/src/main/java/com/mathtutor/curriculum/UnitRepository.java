package com.mathtutor.curriculum;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UnitRepository extends JpaRepository<Unit, UUID> {
    List<Unit> findByGradeIdAndActiveTrueOrderByOrdering(UUID gradeId);
    List<Unit> findByGradeIdOrderByOrdering(UUID gradeId);
}
