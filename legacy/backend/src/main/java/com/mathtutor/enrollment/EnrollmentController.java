package com.mathtutor.enrollment;

import com.mathtutor.auth.StudentService;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.enrollment.EnrollmentService.EnrolledSubject;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;
    private final StudentService studentService;

    public EnrollmentController(EnrollmentService enrollmentService, StudentService studentService) {
        this.enrollmentService = enrollmentService;
        this.studentService = studentService;
    }

    /** Subjects the signed-in student is enrolled in. */
    @GetMapping("/student/subjects")
    @PreAuthorize("hasRole('STUDENT')")
    public List<EnrolledSubject> mySubjects() {
        return enrollmentService.listForStudent(SecurityUtils.currentPrincipal().id());
    }

    /** Parent: subjects a child is enrolled in. */
    @GetMapping("/parent/students/{studentId}/subjects")
    @PreAuthorize("hasRole('PARENT')")
    public List<EnrolledSubject> childSubjects(@PathVariable UUID studentId) {
        studentService.requireOwnedStudent(SecurityUtils.currentPrincipal(), studentId);
        return enrollmentService.listForStudent(studentId);
    }

    /** Parent: enroll a child in a subject by choosing a grade. */
    @PostMapping("/parent/students/{studentId}/enroll")
    @PreAuthorize("hasRole('PARENT')")
    public void enroll(@PathVariable UUID studentId, @RequestBody EnrollRequest request) {
        AuthPrincipal parent = SecurityUtils.currentPrincipal();
        studentService.requireOwnedStudent(parent, studentId);
        enrollmentService.enroll(studentId, request.gradeId());
    }

    public record EnrollRequest(@NotNull UUID gradeId) {
    }
}
