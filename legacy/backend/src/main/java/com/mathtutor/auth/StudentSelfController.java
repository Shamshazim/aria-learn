package com.mathtutor.auth;

import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.Grade;
import com.mathtutor.curriculum.GradeRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/student")
@PreAuthorize("hasRole('STUDENT')")
public class StudentSelfController {

    private final StudentRepository studentRepository;
    private final GradeRepository gradeRepository;

    public StudentSelfController(StudentRepository studentRepository, GradeRepository gradeRepository) {
        this.studentRepository = studentRepository;
        this.gradeRepository = gradeRepository;
    }

    @GetMapping("/me")
    public StudentProfile me() {
        AuthPrincipal principal = SecurityUtils.currentPrincipal();
        Student student = studentRepository.findById(principal.id())
                .orElseThrow(() -> new NotFoundException("Student not found"));
        UUID gradeId = student.getCurrentGradeId();
        String gradeName = gradeId == null ? null :
                gradeRepository.findById(gradeId).map(Grade::getName).orElse(null);
        return new StudentProfile(student.getId(), student.getDisplayName(), gradeId, gradeName);
    }

    public record StudentProfile(UUID id, String displayName, UUID currentGradeId, String gradeName) {
    }
}
