package com.mathtutor.enrollment;

import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentRepository;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.GradeInfo;
import com.mathtutor.curriculum.GradeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class EnrollmentService {

    private final EnrollmentRepository repository;
    private final StudentRepository studentRepository;
    private final GradeRepository gradeRepository;
    private final CurriculumService curriculumService;

    public EnrollmentService(EnrollmentRepository repository,
                             StudentRepository studentRepository,
                             GradeRepository gradeRepository,
                             CurriculumService curriculumService) {
        this.repository = repository;
        this.studentRepository = studentRepository;
        this.gradeRepository = gradeRepository;
        this.curriculumService = curriculumService;
    }

    public record EnrolledSubject(UUID subjectId, String subjectName, UUID gradeId, String gradeName) {
    }

    @Transactional(readOnly = true)
    public List<EnrolledSubject> listForStudent(UUID studentId) {
        return repository.findByStudentIdAndActiveTrueOrderByCreatedAt(studentId).stream()
                .map(e -> {
                    GradeInfo g = curriculumService.gradeInfo(e.getGradeId());
                    return new EnrolledSubject(g.subjectId(), g.subjectName(), g.gradeId(), g.gradeName());
                })
                .toList();
    }

    /** Enrolls a student in a grade. One grade per subject — re-enrolling switches the grade. */
    @Transactional
    public void enroll(UUID studentId, UUID gradeId) {
        if (!studentRepository.existsById(studentId)) {
            throw new NotFoundException("Student not found");
        }
        GradeInfo g = curriculumService.gradeInfo(gradeId); // validates grade exists
        Enrollment e = repository.findByStudentIdAndSubjectId(studentId, g.subjectId())
                .orElseGet(() -> {
                    Enrollment n = new Enrollment();
                    n.setStudentId(studentId);
                    n.setSubjectId(g.subjectId());
                    return n;
                });
        e.setGradeId(gradeId);
        e.setActive(true);
        repository.save(e);
    }

    @Transactional(readOnly = true)
    public boolean isEnrolledInGrade(UUID studentId, UUID gradeId) {
        return repository.existsByStudentIdAndGradeIdAndActiveTrue(studentId, gradeId);
    }

    /** The student's primary grade (first enrollment), falling back to current_grade_id. */
    @Transactional(readOnly = true)
    public UUID primaryGradeId(UUID studentId) {
        List<Enrollment> enrollments = repository.findByStudentIdAndActiveTrueOrderByCreatedAt(studentId);
        if (!enrollments.isEmpty()) {
            return enrollments.get(0).getGradeId();
        }
        return studentRepository.findById(studentId).map(Student::getCurrentGradeId).orElse(null);
    }
}
