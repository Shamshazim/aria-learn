package com.mathtutor.enrollment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {
    List<Enrollment> findByStudentIdAndActiveTrueOrderByCreatedAt(UUID studentId);
    Optional<Enrollment> findByStudentIdAndSubjectId(UUID studentId, UUID subjectId);
    boolean existsByStudentIdAndGradeIdAndActiveTrue(UUID studentId, UUID gradeId);
}
